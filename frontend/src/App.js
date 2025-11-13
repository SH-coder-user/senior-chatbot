import React, { useState, useRef, useEffect } from 'react';
import { Mic, Volume2, Home } from 'lucide-react';
import PrintModal from './PrintModal'; // Import the modal component
import './App.css'; // Import the new App.css for styling

const FLOW_STAGES = {
  READY: 'ready',
  GROUP_SELECTION: 'groupSelection',
  DETAIL: 'detailCollection',
  SUMMARY_CONFIRM: 'summaryConfirm',
  VISIT_HANDOFF: 'visitHandoff',
  DOCUMENT_GUIDE: 'documentGuide',
  PRINT_CONFIRM: 'printConfirm',
  COMPLETE: 'complete'
};

const GROUP_OPTIONS = {
  personal: {
    label: '개인/생활',
    voiceMatches: ['개인', '생활', '가정']
  },
  public: {
    label: '공공',
    voiceMatches: ['공공', '행정', '기관']
  }
};

const DETAIL_SILENCE_MS = 5000;
const PRINT_COUNTDOWN_SECONDS = 20;
const SCREEN_LABELS = {
  home: '대기 중',
  listening: '음성 수집',
  processing: '분석 중',
  response: '응답 중',
  choice: '사용자 선택 대기',
  thankyou: '대화 종료'
};

const guidanceLibrary = {
  '시설': {
    visit:
      '시설팀 현장 조사 대상입니다. 파손 위치와 주변 지형을 사진으로 남겨 두시면 조사원이 도착 전에 상황을 파악하는 데 큰 도움이 됩니다. 24시간 이내에 방문 일정을 문자로 안내해 드릴게요.',
    documents:
      '시설 민원은 고장 위치, 발견 시간, 근처 건물명을 메모해 두시면 접수 즉시 처리 순서를 정할 수 있습니다. 가능한 경우 사진 한 장을 함께 준비해 주세요.'
  },
  '교통': {
    visit:
      '교통 관련 민원 중 안전에 영향을 주는 사안이라 현장 교통정책과 인력이 출동합니다. 차량 통행이 어려운 시간대를 알려 주시면 그 시간대를 피해 점검 일정을 잡겠습니다.',
    documents:
      '버스나 신호등과 같은 교통 민원은 발생 시간, 노선/차량 번호, 위치 좌표를 기록해 두시면 바로 확인할 수 있습니다.'
  },
  '복지': {
    visit:
      '사회복지 상담이 필요한 사안으로 분류되어 담당 공무원이 가정 방문 일정을 잡을 수 있습니다. 방문을 원하시면 가족이나 보호자와 함께할 수 있는 시간대를 알려 주세요.',
    documents:
      '복지 민원은 주민등록등본, 수급 증빙 서류, 연락 가능한 보호자 정보를 준비해 두시면 빠르게 검토할 수 있습니다.'
  },
  '환경': {
    visit:
      '환경오염 현장을 직접 확인해야 하는 유형입니다. 사진이나 동영상을 확보하셨다면 함께 전달해 주세요. 담당 조사원이 채증 도구를 준비해 출동합니다.',
    documents:
      '환경 민원은 발생 위치, 빈도, 냄새/소음 정도를 기록해 두시면 행정처리 시점이 앞당겨집니다.'
  },
  '건강': {
    visit:
      '건강 관련 민원 중 긴급 검진이 필요한 사안으로 분류되어 보건소 방문이나 가정 방문 검진을 안내해 드릴 수 있습니다. 증상이 심해지면 129 또는 119에 즉시 연락하시기 바랍니다.',
    documents:
      '건강 민원은 진료 기록, 복용 중인 약, 증상이 시작된 시각 등을 메모해 두면 담당 보건소에서 빠르게 대응할 수 있습니다.'
  },
  '안전': {
    visit:
      '안전 민원으로 분류되어 즉시 현장 점검이 필요합니다. 위험 구역에는 접근하지 마시고, 임시 조치가 필요하면 112 또는 119와도 연계해 드릴 수 있습니다.',
    documents:
      '안전 민원 접수 시 연락 가능한 번호와 목격자 정보를 남겨 두시면 조치 결과를 빠르게 공유받을 수 있습니다.'
  },
  '기타': {
    visit:
      '현장 확인이 필요한 유형으로 분류했습니다. 해당 부서 조사원이 방문할 수 있도록 시간과 장소를 다시 한 번 확인해 주세요.',
    documents:
      '추가 자료가 있다면 사진이나 문서를 준비해 두시면 담당자가 확인하기 좋습니다.'
  }
};

const INITIAL_CONVERSATION_STATE = Object.freeze({
  groupType: '',
  detailCategory: '',
  agency: '',
  summary: '',
  fullText: '',
  requiresVisit: false,
  guidance: '',
  printRequested: false
});

const createInitialConversationState = () => ({ ...INITIAL_CONVERSATION_STATE });

const SeniorChatbot = () => {
  const [screen, setScreen] = useState('home');
  const [conversationData, setConversationData] = useState(createInitialConversationState);
  const [isListening, setIsListening] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [flowStage, setFlowStage] = useState(FLOW_STAGES.READY);
  const [debugMode, setDebugMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [debugLogs, setDebugLogs] = useState([]);
  const [choiceOptions, setChoiceOptions] = useState([]);
  const [choicePrompt, setChoicePrompt] = useState('');
  const [printCountdown, setPrintCountdown] = useState(PRINT_COUNTDOWN_SECONDS);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false); // State for print modal

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timeoutRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const choiceOptionsRef = useRef([]);
  const speechUtteranceRef = useRef(null);

  useEffect(() => {
    if (flowStage !== FLOW_STAGES.PRINT_CONFIRM) {
      return undefined;
    }
    setPrintCountdown(PRINT_COUNTDOWN_SECONDS);
    let seconds = PRINT_COUNTDOWN_SECONDS;
    const interval = setInterval(() => {
      seconds -= 1;
      setPrintCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      if (seconds <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [flowStage]);

  const addDebugLog = (label, payload) => {
    setDebugLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        label,
        payload
      }
    ]);
  };

  const updateChoiceOptions = (options = []) => {
    setChoiceOptions(options);
    choiceOptionsRef.current = options;
  };

  const speak = (text) => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onstart = () => {
          setIsSpeaking(true);
          addDebugLog('음성 출력 시작', { text });
        };
        
        utterance.onend = () => {
          setIsSpeaking(false);
          addDebugLog('음성 출력 완료', { text });
          resolve();
        };
        
        utterance.onerror = (error) => {
          setIsSpeaking(false);
          addDebugLog('음성 출력 오류', error);
          resolve();
        };
        
        speechUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  };

  const speakAndDisplay = async (
    text,
    { expectChoice = false, afterSpeech, stage = flowStage, options = null } = {}
  ) => {
    setCurrentQuestion(text);
    setChatHistory(prev => [...prev, { speaker: 'assistant', text }]);
    addDebugLog('응답 출력', { stage, text, expectChoice });
    
    if (expectChoice) {
      setChoicePrompt(text);
      updateChoiceOptions(options || buildYesNoOptions());
      setScreen('choice');
    } else {
      setChoicePrompt('');
      updateChoiceOptions([]);
      setScreen('response');
    }
    
    await speak(text);
    
    if (afterSpeech) {
      afterSpeech();
    }
  };

  const buildYesNoOptions = () => [
    {
      key: 'yes',
      label: '예',
      type: 'yesno',
      value: true,
      voiceMatches: ['예', '네', '그래', '응', '맞아', '좋아']
    },
    {
      key: 'no',
      label: '아니오',
      type: 'yesno',
      value: false,
      voiceMatches: ['아니', '아니오', '아냐', '싫어', '노']
    }
  ];

  const interpretGroupFromText = (text) => {
    const compact = text.replace(/\s/g, '');
    if (GROUP_OPTIONS.personal.voiceMatches.some((match) => compact.includes(match))) {
      return 'personal';
    }
    if (GROUP_OPTIONS.public.voiceMatches.some((match) => compact.includes(match))) {
      return 'public';
    }
    return '';
  };

  const handleOptionSelection = (option, { skipLog = false } = {}) => {
    if (!skipLog) {
      setChatHistory((prev) => [...prev, { speaker: 'user', text: option.label }]);
    }
    addDebugLog('옵션 선택', {
      stage: flowStage,
      option: option.key || option.label,
      viaVoice: skipLog
    });
    if (option.type === 'group') {
      handleGroupSelection(option.value);
      return;
    }
    if (option.type === 'yesno') {
      handleYesNoChoice(option.value);
      return;
    }
    if (option.type === 'finish') {
      handleFinishAcknowledgement();
    }
  };

  const attemptMatchOptionByVoice = (text) => {
    const compact = text.replace(/\s/g, '');
    const matched = choiceOptionsRef.current.find((option) =>
      option.voiceMatches?.some((keyword) => compact.includes(keyword))
    );
    if (matched) {
      handleOptionSelection(matched, { skipLog: true });
      return true;
    }
    return false;
  };

  const parseYesNo = (text) => {
    const compact = text.replace(/\s/g, '');
    const positives = ['예', '네', '그래', '응', '맞아', '좋아', '확인'];
    const negatives = ['아니', '아니오', '아냐', '싫어', '노'];
    if (positives.some((keyword) => compact.includes(keyword))) {
      return true;
    }
    if (negatives.some((keyword) => compact.includes(keyword))) {
      return false;
    }
    return null;
  };

  const determineVisitNeed = (summaryText, groupType) => {
    const visitKeywords = ['현장', '방문', '점검', '파손', '위험', '고장', '침수', '소음', '냄새', '조사'];
    const documentKeywords = ['신청', '서류', '발급', '증명', '접수', '문의'];
    const compact = summaryText.replace(/\s/g, '');
    if (visitKeywords.some((keyword) => compact.includes(keyword))) {
      return true;
    }
    if (documentKeywords.some((keyword) => compact.includes(keyword))) {
      return false;
    }
    return groupType === 'public';
  };

  const handleStartFlow = () => {
    if (isListening) {
      stopRecording();
    }
    promptGroupSelection();
  };

  async function promptGroupSelection() {
    setConversationData(createInitialConversationState());
    setFlowStage(FLOW_STAGES.GROUP_SELECTION);
    const options = Object.entries(GROUP_OPTIONS).map(([value, meta]) => ({
      key: value,
      label: meta.label,
      type: 'group',
      value,
      voiceMatches: meta.voiceMatches
    }));
    const prompt =
      '안녕하세요. 무엇을 도와드릴까요? 개인/생활 민원인지, 공공 민원인지 골라주세요.';
    await speakAndDisplay(prompt, {
      expectChoice: true,
      stage: FLOW_STAGES.GROUP_SELECTION,
      options
    });
  }

  async function handleGroupSelection(groupKey) {
    const selected = GROUP_OPTIONS[groupKey];
    if (!selected) {
      await speakAndDisplay('다시 선택해 주세요.', {
        expectChoice: false,
        stage: FLOW_STAGES.GROUP_SELECTION,
        afterSpeech: () => promptGroupSelection()
      });
      return;
    }
    setConversationData({
      ...createInitialConversationState(),
      groupType: groupKey
    });
    setFlowStage(FLOW_STAGES.DETAIL);
    const message = `${selected.label} 민원을 선택하셨습니다. 어떤 점이 불편하신지 자세히 말씀해주세요. 이야기가 끝나면 녹음이 자동으로 종료됩니다.`;
    await speakAndDisplay(message, {
      stage: FLOW_STAGES.DETAIL,
      expectChoice: false,
      afterSpeech: () => {
        setTimeout(() => startRecording(FLOW_STAGES.DETAIL), 1000);
      }
    });
  }

  const handleYesNoChoice = async (isYes) => {
    addDebugLog('사용자 선택', { stage: flowStage, choice: isYes ? '예' : '아니오' });
    if (flowStage === FLOW_STAGES.SUMMARY_CONFIRM) {
      if (isYes) {
        await handleAIDecision();
      } else {
        await speakAndDisplay('처음부터 다시 시작하겠습니다.', {
          stage: FLOW_STAGES.GROUP_SELECTION,
          expectChoice: false,
          afterSpeech: () => {
            setTimeout(() => promptGroupSelection(), 1000);
          }
        });
      }
      return;
    }
    if (flowStage === FLOW_STAGES.PRINT_CONFIRM) {
      await handlePrintDecision(isYes);
    }
  };

  const handleFinishAcknowledgement = async () => {
    setFlowStage(FLOW_STAGES.PRINT_CONFIRM);
    setPrintCountdown(PRINT_COUNTDOWN_SECONDS);
    
    const summaryMessage = `접수된 내용을 출력해서 보관하시겠습니까? 20초 안에 '예' 또는 '아니오'로 답해주세요.`;
    
    await speakAndDisplay(summaryMessage, {
      expectChoice: true,
      stage: FLOW_STAGES.PRINT_CONFIRM,
      options: buildYesNoOptions()
    });
  };

  const handleAIDecision = async () => {
    if (!conversationData.summary) {
      await speakAndDisplay('민원 내용을 먼저 말씀해주세요.', {
        stage: FLOW_STAGES.DETAIL,
        expectChoice: false,
        afterSpeech: () => startRecording(FLOW_STAGES.DETAIL)
      });
      return;
    }
    const detailCategory = conversationData.detailCategory || analyzeComplaint(conversationData.summary);
    const agency = getAgency(detailCategory);
    const requiresVisit = determineVisitNeed(conversationData.summary, conversationData.groupType);
    const guidanceSet = guidanceLibrary[detailCategory] || guidanceLibrary['기타'];
    const guidanceText = requiresVisit ? guidanceSet.visit : guidanceSet.documents;
    setConversationData((prev) => ({
      ...prev,
      detailCategory,
      agency,
      requiresVisit,
      guidance: guidanceText
    }));
    if (requiresVisit) {
      await handleVisitFlow(agency, guidanceText);
    } else {
      await handleDocumentGuidance(guidanceText);
    }
  };

  const handleVisitFlow = async (agency, guidanceText) => {
    setFlowStage(FLOW_STAGES.VISIT_HANDOFF);
    const message = `${agency}에서 현장 확인이 필요하다고 판단했습니다. ${guidanceText}`;
    const options = [
      {
        key: 'finish',
        label: '안내 확인',
        type: 'finish',
        voiceMatches: ['확인', '예', '네', '그래']
      }
    ];
    await speakAndDisplay(message, {
      expectChoice: true,
      stage: FLOW_STAGES.VISIT_HANDOFF,
      options
    });
  };

  const handleDocumentGuidance = async (guidanceText) => {
    setFlowStage(FLOW_STAGES.DOCUMENT_GUIDE);
    const message = `필요한 서류 안내입니다. ${guidanceText}`;
    await speakAndDisplay(message, {
      stage: FLOW_STAGES.DOCUMENT_GUIDE,
      expectChoice: false,
      afterSpeech: () => {
        setTimeout(() => promptPrintQuestion(), 1000);
      }
    });
  };

  const promptPrintQuestion = async () => {
    setFlowStage(FLOW_STAGES.PRINT_CONFIRM);
    setPrintCountdown(PRINT_COUNTDOWN_SECONDS);
    const message = '안내 내용을 종이로 출력하시겠습니까?';
    await speakAndDisplay(message, {
      expectChoice: true,
      stage: FLOW_STAGES.PRINT_CONFIRM,
      options: buildYesNoOptions()
    });
  };

  const handlePrintDecision = async (isYes) => {
    setConversationData((prev) => ({
      ...prev,
      printRequested: isYes
    }));
    if (isYes) {
      setShowPrintModal(true); // Show the modal
    } else {
      const closing = '출력하지 않고 민원 접수를 마칩니다. 이용해주셔서 감사합니다.';
      await completeFlow(closing);
    }
  };

  const handleCloseModalAndReset = async () => {
    setShowPrintModal(false);
    const closing = '민원 접수가 완료되었습니다. 이용해주셔서 감사합니다.';
    await completeFlow(closing);
  };

  const completeFlow = async (closingMessage) => {
    await saveComplaint();
    await speakAndDisplay(closingMessage, {
      stage: FLOW_STAGES.COMPLETE,
      expectChoice: false,
      afterSpeech: () => {
        setScreen('thankyou');
        setTimeout(() => resetConversation(), 5000);
      }
    });
  };

  const startRecording = async (stageForInput) => {
    if (isListening) {
      return;
    }
    
    const recordingStage = stageForInput || flowStage;
    addDebugLog('녹음 시작 요청', { stage: recordingStage, flowStage });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      const resetSilenceTimer = () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        if (recordingStage === FLOW_STAGES.DETAIL) {
          silenceTimeoutRef.current = setTimeout(() => {
            addDebugLog('무응답 자동 종료', { stage: recordingStage });
            stopRecording();
          }, DETAIL_SILENCE_MS);
        }
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
        resetSilenceTimer();
      };

      mediaRecorderRef.current.onstop = async () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsListening(false);
        setScreen('processing');
        addDebugLog('녹음 종료', { size: audioBlob.size, stage: recordingStage });
        await processAudio(audioBlob, recordingStage);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      setScreen('listening');

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 30000);

      resetSilenceTimer();
    } catch (error) {
      console.error('마이크 접근 오류:', error);
      addDebugLog('마이크 오류', error.message);
      alert('마이크 사용 권한이 필요합니다.');
    }
  };

  const stopRecording = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (audioBlob, stageForInput) => {
    const currentStage = stageForInput || flowStage;
    setScreen('processing');
    addDebugLog('음성 처리 시작', { size: audioBlob.size, stage: currentStage });

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      let userText = '예';
      if (currentStage === FLOW_STAGES.GROUP_SELECTION) {
        userText = '개인 민원입니다';
      } else if (currentStage === FLOW_STAGES.DETAIL) {
        userText = '우리 동네 공원에 가로등이 고장나서 밤에 너무 어두워요. 언제 고칠 수 있을까요?';
      }
      addDebugLog('음성 → 텍스트 결과', { stage: currentStage, text: userText });

      await handleStageInput(userText, currentStage);

    } catch (error) {
      console.error('음성 처리 오류:', error);
      addDebugLog('음성 처리 오류', error.message);
      await speak('죄송합니다. 다시 한 번 말씀해 주시겠어요?');
      setScreen('home');
    }
  };

  const handleStageInput = async (userText, stageOverride = flowStage) => {
    const trimmedText = userText.trim();
    const targetStage = stageOverride || flowStage;
    if (!trimmedText) {
      if (targetStage === FLOW_STAGES.DETAIL) {
        await handleDetailResponse('');
      } else if (
        targetStage === FLOW_STAGES.GROUP_SELECTION ||
        targetStage === FLOW_STAGES.SUMMARY_CONFIRM ||
        targetStage === FLOW_STAGES.PRINT_CONFIRM
      ) {
        await speakAndDisplay('입력이 감지되지 않았습니다. 다시 말씀해주세요.', {
          expectChoice: true,
          stage: targetStage
        });
      }
      return;
    }

    setChatHistory((prev) => [...prev, { speaker: 'user', text: trimmedText }]);
    addDebugLog('사용자 입력 수신', { stage: targetStage, text: trimmedText });

    if (targetStage === FLOW_STAGES.GROUP_SELECTION) {
      if (!attemptMatchOptionByVoice(trimmedText)) {
        const interpreted = interpretGroupFromText(trimmedText);
        if (interpreted) {
          await handleGroupSelection(interpreted);
        } else {
          await speakAndDisplay('개인/생활 또는 공공 중에서 다시 골라주세요.', {
            stage: FLOW_STAGES.GROUP_SELECTION,
            expectChoice: false,
            afterSpeech: () => {
              setTimeout(() => promptGroupSelection(), 1000);
            }
          });
        }
      }
      return;
    }

    if (targetStage === FLOW_STAGES.DETAIL) {
      await handleDetailResponse(trimmedText);
      return;
    }

    if (targetStage === FLOW_STAGES.VISIT_HANDOFF) {
      if (!attemptMatchOptionByVoice(trimmedText)) {
        await speakAndDisplay('"확인"이라고 말씀하시거나 버튼을 눌러주세요.', {
          expectChoice: true,
          stage: targetStage
        });
      }
      return;
    }

    if (targetStage === FLOW_STAGES.SUMMARY_CONFIRM || targetStage === FLOW_STAGES.PRINT_CONFIRM) {
      const matched = attemptMatchOptionByVoice(trimmedText);
      if (matched) {
        return;
      }
      const yesNo = parseYesNo(trimmedText);
      if (yesNo !== null) {
        await handleYesNoChoice(yesNo);
        return;
      }
      await speakAndDisplay('"예" 또는 "아니오"로 답해주세요.', {
        expectChoice: true,
        stage: targetStage
      });
      return;
    }

    addDebugLog('예상치 못한 입력 단계', targetStage);
  };

  async function handleDetailResponse(trimmedText) {
    const effectiveText = trimmedText || '음성 입력이 감지되지 않았습니다.';
    const detailCategory = analyzeComplaint(effectiveText);
    const agency = getAgency(detailCategory);
    const summary = generateSummary(effectiveText, '', detailCategory);
    addDebugLog('요약 생성', summary);
    setConversationData((prev) => ({
      ...prev,
      detailCategory,
      agency,
      fullText: effectiveText,
      summary
    }));
    setFlowStage(FLOW_STAGES.SUMMARY_CONFIRM);
    const response = `말씀하신 내용을 이렇게 정리했습니다. "${summary}" 이 내용이 맞으신가요?`;
    await speakAndDisplay(response, {
      expectChoice: true,
      stage: FLOW_STAGES.SUMMARY_CONFIRM,
      options: buildYesNoOptions()
    });
  }

  const saveComplaint = async () => {
    const complaintData = {
      groupType: conversationData.groupType,
      detailCategory: conversationData.detailCategory,
      agency: conversationData.agency,
      summary: conversationData.summary,
      fullText: conversationData.fullText,
      requiresVisit: conversationData.requiresVisit,
      guidance: conversationData.guidance,
      printRequested: conversationData.printRequested,
      status: '접수완료',
      timestamp: new Date().toISOString(),
      chatLogs: chatHistory
    };

    try {
      const response = await fetch('http://localhost:5000/api/complaints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(complaintData)
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 민원 저장 완료:', result.data);
        addDebugLog('민원 저장 완료', result.data);
      } else {
        console.error('❌ 민원 저장 실패:', result.message);
        addDebugLog('민원 저장 실패', result.message);
      }
    } catch (error) {
      console.error('❌ API 호출 오류:', error);
      addDebugLog('API 오류 - 로컬 백업', error.message);
    }
  };

  const resetConversation = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isListening && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      } catch (e) {
        console.error('녹음 중지 오류:', e);
      }
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    updateChoiceOptions([]);
    setChoicePrompt('');
    setPrintCountdown(PRINT_COUNTDOWN_SECONDS);
    setIsListening(false);
    setScreen('home');
    setFlowStage(FLOW_STAGES.READY);
    setConversationData(createInitialConversationState());
    setCurrentQuestion('');
    setChatHistory([]);
    setManualInput('');
    setIsSpeaking(false);
    addDebugLog('전체 초기화 완료', { screen: 'home' });
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    const text = manualInput.trim();
    if (!text) {
      return;
    }
    setManualInput('');
    await handleStageInput(text);
  };

  const handleClearLogs = () => {
    setChatHistory([]);
    setDebugLogs([]);
  };

  const analyzeComplaint = (text) => {
    const keywords = {
      '시설': ['가로등', '공원', '시설', '건물', '화장실', '벤치', '놀이터', '도로', '인도'],
      '복지': ['복지', '연금', '수당', '지원금', '보조금', '지원'],
      '교통': ['버스', '교통', '택시', '정류장', '신호등', '횡단보도'],
      '건강': ['병원', '건강', '검진', '의료', '아프', '치료'],
      '환경': ['쓰레기', '청소', '소음', '냄새', '환경'],
      '안전': ['안전', '위험', '사고', 'CCTV']
    };

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        return category;
      }
    }
    return '기타';
  };

  const getAgency = (category) => {
    const agencies = {
      '복지': '복지정책과',
      '교통': '교통행정과',
      '시설': '도시관리과',
      '건강': '보건소',
      '환경': '환경위생과',
      '안전': '안전총괄과',
      '기타': '민원봉사과'
    };
    return agencies[category] || '민원봉사과';
  };

  const generateSummary = (mainText, additionalText, category) => {
    const combined = additionalText ? `${mainText} ${additionalText}` : mainText;
    const words = combined.split(' ');
    const summary = words.slice(0, 20).join(' ');
    return `${category} 관련: ${summary}${words.length > 20 ? '...' : ''}`;
  };

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <div className="text-center">
            <div className="mb-12">
              <h1 className="main-title">생활 민원 도우미</h1>
              <p className="subtitle">불편하신 점을 말씀해 주세요</p>
              <p className="description">아래 버튼을 누르고 편하게 말씀하시면 됩니다</p>
            </div>
            <button onClick={handleStartFlow} className="action-button">
              대화 시작하기
            </button>
          </div>
        );

      case 'listening':
        return (
          <div className="text-center">
            <div className="mb-12">
              <div className="inline-block p-12 bg-red-500 rounded-full animate-pulse mb-8">
                <Mic size={80} className="text-white" />
              </div>
              <h2 className="status-heading">듣고 있습니다</h2>
              <p className="status-text">편하게 말씀해 주세요</p>
            </div>
            <button onClick={stopRecording} className="bg-gray-500 text-white text-3xl font-bold py-8 px-16 rounded-3xl hover:bg-gray-600 transition-all">
              말씀 완료
            </button>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center">
            <div className="mb-12">
              <div className="inline-block p-12 bg-blue-500 rounded-full mb-8">
                <Volume2 size={80} className="text-white animate-bounce" />
              </div>
              <h2 className="status-heading">처리 중입니다</h2>
              <p className="status-text">잠시만 기다려 주세요...</p>
            </div>
          </div>
        );

      case 'response':
        return (
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-12">
              <div className="inline-block p-12 bg-green-500 rounded-full mb-8">
                <Volume2 size={80} className="text-white" />
              </div>
              <div className="response-box">
                <p className="response-text">{currentQuestion}</p>
              </div>
              {isSpeaking && (
                <p className="text-2xl text-gray-500 mt-6 animate-pulse">
                  음성 안내 중...
                </p>
              )}
            </div>
          </div>
        );

      case 'choice':
        return (
          <div className="text-center">
            <div className="mb-12">
              <h2 className="text-4xl font-bold text-gray-800 mb-12 whitespace-pre-line">
                {choicePrompt || '옵션 중 하나를 선택해 주세요'}
              </h2>
              {isSpeaking && (
                <p className="text-2xl text-gray-500 mb-8 animate-pulse">
                  음성 안내 중...
                </p>
              )}
              <div className="flex justify-center gap-6 flex-wrap">
                {choiceOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleOptionSelection(option)}
                    disabled={isSpeaking}
                    className={`choice-button ${ 
                      isSpeaking 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {flowStage === FLOW_STAGES.PRINT_CONFIRM && (
                <p className="countdown-text">
                  남은 시간: {printCountdown}초
                </p>
              )}
            </div>
          </div>
        );

      case 'thankyou':
        return (
          <div className="text-center">
            <div className="mb-12">
              <div className="inline-block p-12 bg-green-500 rounded-full mb-8">
                <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="status-heading">감사합니다</h2>
              <p className="status-text">민원 접수가 완료되었습니다.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-6xl">
        <div className="chatbot-container">
          {renderScreen()}
        </div>

        {screen !== 'home' && (
          <div className="fixed bottom-8 right-8">
            <button
              onClick={resetConversation}
              className="bg-gray-600 text-white p-6 rounded-full hover:bg-gray-700 transition-all shadow-xl"
              title="처음으로"
            >
              <Home size={32} />
            </button>
          </div>
        )}
      </div>
      {showPrintModal && (
        <PrintModal 
          conversationData={conversationData} 
          onClose={handleCloseModalAndReset} 
        />
      )}
    </div>
  );
};

export default SeniorChatbot;
