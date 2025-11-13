import React, { useState, useRef, useEffect } from 'react';
import { Mic, Volume2, Home } from 'lucide-react';

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

const SeniorChatbot = () => {
  const [screen, setScreen] = useState('home'); // home, listening, processing, response, thankyou
  const createInitialConversationState = () => ({
    groupType: '',
    detailCategory: '',
    agency: '',
    summary: '',
    fullText: '',
    requiresVisit: false,
    guidance: '',
    printRequested: false
  });
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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timeoutRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const choiceOptionsRef = useRef([]);

  const screenLabels = {
    home: '대기 중',
    listening: '음성 수집',
    processing: '분석 중',
    response: '응답 중',
    choice: '사용자 선택 대기',
    thankyou: '대화 종료'
  };

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

  const speakAndDisplay = (
    text,
    { expectChoice = false, afterSpeech, stage = flowStage, options = null } = {}
  ) => {
    setCurrentQuestion(text);
    setChatHistory(prev => [...prev, { speaker: 'assistant', text }]);
    addDebugLog('응답 출력', { stage, text });
    if (expectChoice) {
      setChoicePrompt(text);
      updateChoiceOptions(options || buildYesNoOptions());
      setScreen('choice');
    } else {
      setChoicePrompt('');
      updateChoiceOptions([]);
      setScreen('response');
    }
    speak(text);
    const delay = Math.max(2500, text.length * 70);
    if (afterSpeech) {
      setTimeout(afterSpeech, delay);
    }
  };

  // 음성 합성 함수
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.85; // 천천히
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
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

  function promptGroupSelection() {
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
      '안내를 시작합니다. 개인/생활 또는 공공 민원인지 버튼을 누르거나 음성으로 말씀해 주세요. 잘못 말씀하시면 다시 처음 화면으로 돌아갑니다.';
    speakAndDisplay(prompt, {
      expectChoice: true,
      stage: FLOW_STAGES.GROUP_SELECTION,
      options
    });
  }

  function handleGroupSelection(groupKey) {
    const selected = GROUP_OPTIONS[groupKey];
    if (!selected) {
      promptGroupSelection();
      return;
    }
    setConversationData((prev) => ({
      ...createInitialConversationState(),
      groupType: groupKey
    }));
    setFlowStage(FLOW_STAGES.DETAIL);
    const message = `${selected.label} 민원으로 접수하겠습니다. 위치, 시간, 어떤 불편이 있었는지 5초 이상 조용하면 자동으로 녹음이 종료됩니다.`;
    speakAndDisplay(message, {
      stage: FLOW_STAGES.DETAIL,
      afterSpeech: () => startRecording(FLOW_STAGES.DETAIL)
    });
  }

  const handleYesNoChoice = (isYes) => {
    addDebugLog('사용자 선택', { stage: flowStage, choice: isYes ? '예' : '아니오' });
    if (flowStage === FLOW_STAGES.SUMMARY_CONFIRM) {
      if (isYes) {
        handleAIDecision();
      } else {
        speakAndDisplay('민원 유형 선택 단계로 돌아가 다시 안내해 드릴게요.', {
          stage: FLOW_STAGES.GROUP_SELECTION,
          afterSpeech: () => promptGroupSelection()
        });
      }
      return;
    }
    if (flowStage === FLOW_STAGES.PRINT_CONFIRM) {
      handlePrintDecision(isYes);
    }
  };

  const handleFinishAcknowledgement = () => {
    const department = conversationData.agency || '담당 부서';
    const closing = `${department}에 전달을 완료했습니다. 안내를 마치고 처음 화면으로 돌아갑니다.`;
    completeFlow(closing);
  };

  const handleAIDecision = () => {
    if (!conversationData.summary) {
      speakAndDisplay('민원 내용을 먼저 들려주시면 도와드릴 수 있습니다.', {
        stage: FLOW_STAGES.DETAIL,
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
      handleVisitFlow(agency, guidanceText);
    } else {
      handleDocumentGuidance(guidanceText);
    }
  };

  const handleVisitFlow = (agency, guidanceText) => {
    setFlowStage(FLOW_STAGES.VISIT_HANDOFF);
    const message = `${guidanceText}\n\n${agency} 담당자가 현장 조사가 필요한 민원으로 판단했습니다. 방문 일정을 잡고 안내드리겠습니다. 안내를 마치려면 확인 버튼을 누르거나 확인이라고 말씀해 주세요.`;
    const options = [
      {
        key: 'finish',
        label: '안내 확인',
        type: 'finish',
        voiceMatches: ['확인', '예', '네', '그래']
      }
    ];
    speakAndDisplay(message, {
      expectChoice: true,
      stage: FLOW_STAGES.VISIT_HANDOFF,
      options
    });
  };

  const handleDocumentGuidance = (guidanceText) => {
    setFlowStage(FLOW_STAGES.DOCUMENT_GUIDE);
    const message = `${guidanceText}\n\n안내된 서류를 준비하시면 공공기관에서 바로 접수를 도와드릴 수 있습니다.`;
    speakAndDisplay(message, {
      stage: FLOW_STAGES.DOCUMENT_GUIDE,
      afterSpeech: () => promptPrintQuestion()
    });
  };

  const promptPrintQuestion = () => {
    setFlowStage(FLOW_STAGES.PRINT_CONFIRM);
    setPrintCountdown(PRINT_COUNTDOWN_SECONDS);
    const message = '필요 서류를 A4 용지에 출력하시겠습니까? 예 또는 아니오로 말씀하거나 버튼을 눌러 주세요. 이 화면은 20초 동안 유지됩니다.';
    speakAndDisplay(message, {
      expectChoice: true,
      stage: FLOW_STAGES.PRINT_CONFIRM,
      options: buildYesNoOptions()
    });
  };

  const handlePrintDecision = (isYes) => {
    setConversationData((prev) => ({
      ...prev,
      printRequested: isYes
    }));
    const closing = isYes
      ? '안내된 서류를 A4 용지로 출력하도록 담당자에게 전달했습니다. 출력이 완료되면 화면에 표시됩니다.'
      : '서류 출력 없이 절차만 안내하도록 기록했습니다.';
    completeFlow(`${closing} 이용해 주셔서 감사합니다.`);
  };

  const completeFlow = async (closingMessage) => {
    await saveComplaint();
    speakAndDisplay(closingMessage, {
      stage: FLOW_STAGES.COMPLETE,
      afterSpeech: () => {
        setScreen('thankyou');
        setTimeout(() => resetConversation(), 6000);
      }
    });
  };

  // 음성 녹음 시작
  const startRecording = async (stageForInput = flowStage) => {
    if (isListening) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      addDebugLog('녹음 시작', { stage: stageForInput });

      const resetSilenceTimer = () => {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        if (stageForInput === FLOW_STAGES.DETAIL) {
          silenceTimeoutRef.current = setTimeout(() => {
            addDebugLog('무응답 자동 종료', { stage: stageForInput });
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
        addDebugLog('녹음 종료', { size: audioBlob.size, stage: stageForInput });
        await processAudio(audioBlob, stageForInput);
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

  // 음성 녹음 중지
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

  // Whisper API로 음성을 텍스트로 변환
  const processAudio = async (audioBlob, stageForInput = flowStage) => {
    setScreen('processing');
    addDebugLog('음성 처리 시작', { size: audioBlob.size, stage: stageForInput });

    try {
      // 실제 Whisper API 호출 (여기서는 시뮬레이션)
      // const formData = new FormData();
      // formData.append('file', audioBlob, 'audio.webm');
      // formData.append('model', 'whisper-1');
      // formData.append('language', 'ko');
      
      // const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${YOUR_API_KEY}`
      //   },
      //   body: formData
      // });
      // const result = await response.json();
      // const userText = result.text;

      // 시뮬레이션 (실제로는 위 코드 사용)
      await new Promise(resolve => setTimeout(resolve, 2000));
      let userText = '예';
      if (stageForInput === FLOW_STAGES.GROUP_SELECTION) {
        userText = '개인 민원입니다';
      } else if (stageForInput === FLOW_STAGES.DETAIL) {
        userText = '우리 동네 공원에 가로등이 고장나서 밤에 너무 어두워요. 언제 고칠 수 있을까요?';
      }
      addDebugLog('음성 → 텍스트 결과', { stage: stageForInput, text: userText });

      await handleStageInput(userText, stageForInput);

    } catch (error) {
      console.error('음성 처리 오류:', error);
      addDebugLog('음성 처리 오류', error.message);
      speak('죄송합니다. 다시 한 번 말씀해 주시겠어요?');
      setScreen('home');
    }
  };

  const handleStageInput = async (userText, stageOverride = flowStage) => {
    const trimmedText = userText.trim();
    const targetStage = stageOverride || flowStage;
    if (!trimmedText) {
      if (targetStage === FLOW_STAGES.DETAIL) {
        handleDetailResponse('');
      } else if (
        targetStage === FLOW_STAGES.GROUP_SELECTION ||
        targetStage === FLOW_STAGES.SUMMARY_CONFIRM ||
        targetStage === FLOW_STAGES.PRINT_CONFIRM
      ) {
        speakAndDisplay('입력이 감지되지 않았습니다. 버튼을 누르거나 다시 말씀해 주세요.', {
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
          handleGroupSelection(interpreted);
        } else {
          speakAndDisplay('개인/생활 또는 공공 중 하나로 다시 말씀해 주세요. 처음 화면으로 돌아갑니다.', {
            stage: FLOW_STAGES.GROUP_SELECTION,
            afterSpeech: () => {
              resetConversation();
              promptGroupSelection();
            }
          });
        }
      }
      return;
    }

    if (targetStage === FLOW_STAGES.DETAIL) {
      handleDetailResponse(trimmedText);
      return;
    }

    if (targetStage === FLOW_STAGES.VISIT_HANDOFF) {
      if (!attemptMatchOptionByVoice(trimmedText)) {
        speakAndDisplay('확인이라고 말씀하시거나 버튼을 눌러 안내를 마무리해 주세요.', {
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
        handleYesNoChoice(yesNo);
        return;
      }
      speakAndDisplay('버튼을 누르거나 예/아니오, 확인이라고 답해 주세요.', {
        expectChoice: true,
        stage: targetStage
      });
      return;
    }

    addDebugLog('예상치 못한 입력 단계', targetStage);
  };

  function handleDetailResponse(trimmedText) {
    const effectiveText = trimmedText || '음성 입력이 감지되지 않아 자동으로 녹음을 종료했습니다.';
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
    const response = `민원 내용을 다음과 같이 정리했습니다: ${summary}\n이 내용이 맞습니까? 예 또는 아니오로 답해주세요.`;
    speakAndDisplay(response, {
      expectChoice: true,
      stage: FLOW_STAGES.SUMMARY_CONFIRM,
      options: buildYesNoOptions()
    });
  }

  // 선택 음성 처리 (버튼 이벤트는 handleOptionSelection 사용)

  // 민원 저장
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
      chatLogs: [
        { speaker: 'user', message: conversationData.fullText },
        { speaker: 'assistant', message: conversationData.summary }
      ]
    };

    try {
      // 백엔드 API 호출
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
      // 실패 시 localStorage에 백업 저장
      const complaints = JSON.parse(localStorage.getItem('complaints') || '[]');
      complaints.push(complaintData);
      localStorage.setItem('complaints', JSON.stringify(complaints));
      console.log('📦 로컬에 백업 저장됨');
      addDebugLog('API 오류 - 로컬 백업', error.message);
    }
  };

  // 초기화
  const resetConversation = () => {
    if (isListening) {
      stopRecording();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    updateChoiceOptions([]);
    setChoicePrompt('');
    setPrintCountdown(PRINT_COUNTDOWN_SECONDS);
    setScreen('home');
    setFlowStage(FLOW_STAGES.READY);
    setConversationData(createInitialConversationState());
    setCurrentQuestion('');
    setChatHistory([]);
    setManualInput('');
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

  // 민원 분류
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

  // 담당 부서
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

  // 요약 생성
  const generateSummary = (mainText, additionalText, category) => {
    const combined = additionalText ? `${mainText} ${additionalText}` : mainText;
    const words = combined.split(' ');
    const summary = words.slice(0, 20).join(' ');
    return `${category} 관련하여 ${summary}${words.length > 20 ? '...' : ''}`;
  };

  // 화면 렌더링
  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <div className="text-center">
            <div className="mb-12">
              <h1 className="text-6xl font-bold text-blue-600 mb-6">
                생활 민원 도우미
              </h1>
              <p className="text-3xl text-gray-600 mb-4">
                불편하신 점을 말씀해 주세요
              </p>
              <p className="text-2xl text-gray-500">
                버튼을 누르고 편하게 말씀하시면 됩니다
              </p>
            </div>
            <button
              onClick={handleStartFlow}
              className="bg-blue-500 text-white text-4xl font-bold py-12 px-20 rounded-3xl hover:bg-blue-600 transition-all shadow-2xl"
            >
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
              <h2 className="text-5xl font-bold text-gray-800 mb-6">
                듣고 있습니다
              </h2>
              <p className="text-3xl text-gray-600 mb-8">
                편하게 말씀해 주세요
              </p>
              <div className="flex justify-center gap-4 mb-8">
                <div className="w-6 h-24 bg-red-400 rounded-full animate-pulse"></div>
                <div className="w-6 h-32 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-6 h-28 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-6 h-36 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-6 h-28 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
            <button
              onClick={stopRecording}
              className="bg-gray-500 text-white text-3xl font-bold py-8 px-16 rounded-3xl hover:bg-gray-600 transition-all"
            >
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
              <h2 className="text-5xl font-bold text-gray-800 mb-6">
                처리 중입니다
              </h2>
              <p className="text-3xl text-gray-600">
                잠시만 기다려 주세요...
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <div className="w-8 h-8 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-8 h-8 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-8 h-8 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
              <div className="bg-white rounded-3xl shadow-xl p-12">
                <p className="text-3xl text-gray-800 leading-relaxed whitespace-pre-line">
                  {currentQuestion}
                </p>
              </div>
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
              <div className="flex justify-center gap-6 flex-wrap">
                {choiceOptions.length === 0 && (
                  <p className="text-2xl text-gray-500">선택 가능한 옵션이 없습니다.</p>
                )}
                {choiceOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => handleOptionSelection(option)}
                    className="bg-blue-500 text-white text-3xl font-bold py-10 px-14 rounded-3xl hover:bg-blue-600 transition-all shadow-xl"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {flowStage === FLOW_STAGES.PRINT_CONFIRM && (
                <p className="text-2xl text-gray-500 mt-8">
                  안내 화면 유지 시간: {printCountdown}초
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-4">
              <p className="text-2xl text-gray-600">또는 아래 버튼을 눌러 음성으로 답하셔도 됩니다</p>
              <button
                onClick={() => startRecording(flowStage)}
                className="inline-flex items-center gap-3 bg-gray-800 text-white text-2xl font-semibold py-4 px-10 rounded-full hover:bg-gray-900 transition-all"
              >
                <Mic size={32} /> 음성으로 답하기
              </button>
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
              <h2 className="text-5xl font-bold text-gray-800 mb-6">
                감사합니다
              </h2>
              <p className="text-3xl text-gray-600">
                이용해 주셔서 감사합니다
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const conversationStep = flowStage;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 flex items-center justify-center p-8">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">현재 상태</p>
            <p className="text-xl font-semibold text-gray-800">
              {screenLabels[screen] || '진행 중'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDebugMode(prev => !prev)}
              className={`px-5 py-2 rounded-full text-sm font-semibold border ${
                debugMode ? 'bg-green-100 border-green-400 text-green-700' : 'bg-white border-gray-300 text-gray-600'
              }`}
            >
              {debugMode ? '디버그 모드 ON' : '디버그 모드 OFF'}
            </button>
            <button
              onClick={handleClearLogs}
              className="px-5 py-2 rounded-full text-sm font-semibold border border-gray-300 text-gray-600 bg-white"
            >
              로그 초기화
            </button>
          </div>
        </div>

        {renderScreen()}

        {debugMode && (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="bg-white/80 rounded-3xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">디버그 대화</h3>
                <span className="text-xs text-gray-500">텍스트로 시뮬레이션 가능</span>
              </div>
              <form onSubmit={handleManualSubmit} className="mb-4 space-y-3">
                <textarea
                  className="w-full border border-gray-200 rounded-2xl p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows="3"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="여기에 문의 내용을 입력하면 음성 대신 텍스트로 분석됩니다."
                ></textarea>
                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white font-semibold py-3 rounded-2xl hover:bg-blue-600 transition-all"
                >
                  디버그 입력 전송
                </button>
              </form>
              <div className="max-h-72 overflow-y-auto space-y-3">
                {chatHistory.length === 0 && (
                  <p className="text-sm text-gray-500">대화 기록이 없습니다. 음성 또는 텍스트로 입력해보세요.</p>
                )}
                {chatHistory.map((log, index) => (
                  <div
                    key={`${log.speaker}-${index}-${log.text}`}
                    className={`rounded-2xl p-3 text-sm shadow-sm ${
                      log.speaker === 'user'
                        ? 'bg-blue-50 text-blue-900'
                        : 'bg-green-50 text-green-900'
                    }`}
                  >
                    <p className="text-xs font-semibold mb-1">
                      {log.speaker === 'user' ? '사용자' : '어시스턴트'}
                    </p>
                    <p className="whitespace-pre-line leading-relaxed">{log.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 text-green-100 rounded-3xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">처리 로그</h3>
                <span className="text-xs text-gray-400">실시간 상태</span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-3 font-mono text-xs">
                {debugLogs.length === 0 && (
                  <p className="text-gray-400">아직 로그가 없습니다.</p>
                )}
                {debugLogs.map((log, index) => (
                  <div key={`${log.label}-${index}-${log.timestamp}`} className="bg-gray-800 rounded-2xl p-3">
                    <div className="text-green-300 font-semibold">
                      [{log.timestamp}] {log.label}
                    </div>
                    {log.payload && (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-green-100">
                        {typeof log.payload === 'string'
                          ? log.payload
                          : JSON.stringify(log.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-2">현재 컨텍스트</p>
                <pre className="text-xs whitespace-pre-wrap break-words">
                  {JSON.stringify(
                    {
                      step: conversationStep,
                      screen,
                      ...conversationData
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
};

export default SeniorChatbot;