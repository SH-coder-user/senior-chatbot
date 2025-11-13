import React, { useState, useRef } from 'react';
import { Mic, Volume2, Home } from 'lucide-react';

const FLOW_STAGES = {
  CATEGORY: 'categorySelection',
  CATEGORY_CONFIRM: 'categoryConfirm',
  DETAIL: 'detailCollection',
  SUMMARY_CONFIRM: 'summaryConfirm',
  FIELD_REQUIREMENT: 'fieldRequirement',
  HANDOFF_CONFIRM: 'handoffConfirm'
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

const SeniorChatbot = () => {
  const [screen, setScreen] = useState('home'); // home, listening, processing, response, thankyou
  const createInitialConversationState = () => ({
    category: '',
    agency: '',
    summary: '',
    fullText: '',
    requiresVisit: false,
    guidance: ''
  });
  const [conversationData, setConversationData] = useState(createInitialConversationState);
  const [isListening, setIsListening] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [flowStage, setFlowStage] = useState(FLOW_STAGES.CATEGORY);
  const [audioBlob, setAudioBlob] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [debugLogs, setDebugLogs] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timeoutRef = useRef(null);

  const screenLabels = {
    home: '대기 중',
    listening: '음성 수집',
    processing: '분석 중',
    response: '응답 중',
    choice: '사용자 선택 대기',
    thankyou: '대화 종료'
  };

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

  const speakAndDisplay = (text, { expectChoice = false, afterSpeech, stage = flowStage } = {}) => {
    setCurrentQuestion(text);
    setChatHistory(prev => [...prev, { speaker: 'assistant', text }]);
    addDebugLog('응답 출력', { stage, text });
    setScreen('response');
    speak(text);
    const delay = Math.max(2500, text.length * 70);
    if (expectChoice) {
      setTimeout(() => setScreen('choice'), delay);
    } else if (afterSpeech) {
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

  // 음성 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      addDebugLog('녹음 시작', { screen: 'listening' });

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        addDebugLog('녹음 종료', { size: audioBlob.size });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      setScreen('listening');

      // 30초 후 자동 종료
      timeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 30000);

    } catch (error) {
      console.error('마이크 접근 오류:', error);
      addDebugLog('마이크 오류', error.message);
      alert('마이크 사용 권한이 필요합니다.');
    }
  };

  // 음성 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  // Whisper API로 음성을 텍스트로 변환
  const processAudio = async (audioBlob) => {
    setScreen('processing');
    addDebugLog('음성 처리 시작', { size: audioBlob.size });

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
      const userText = "우리 동네 공원에 가로등이 고장나서 밤에 너무 어두워요. 언제 고칠 수 있을까요?";
      addDebugLog('음성 → 텍스트 결과', userText);

      await analyzeAndRespond(userText);

    } catch (error) {
      console.error('음성 처리 오류:', error);
      addDebugLog('음성 처리 오류', error.message);
      speak('죄송합니다. 다시 한 번 말씀해 주시겠어요?');
      setScreen('home');
    }
  };

  // 대화 분석 및 응답 생성
  const analyzeAndRespond = async (userText) => {
    const trimmedText = userText.trim();
    if (!trimmedText) {
      return;
    }
    setScreen('processing');
    setChatHistory(prev => [...prev, { speaker: 'user', text: trimmedText }]);
    addDebugLog('사용자 입력 수신', { stage: flowStage, text: trimmedText });

    if (flowStage === FLOW_STAGES.CATEGORY) {
      const category = analyzeComplaint(trimmedText);
      const agency = getAgency(category);
      addDebugLog('분류 결과', { category, agency });
      setConversationData(prev => ({
        ...prev,
        category,
        agency,
        fullText: trimmedText
      }));
      setFlowStage(FLOW_STAGES.CATEGORY_CONFIRM);
      const response = `말씀 감사합니다. ${category} 관련 민원으로 분류되며 ${agency}에서 담당합니다. 맞습니까? 예 또는 아니오로 답해주세요.`;
      speakAndDisplay(response, { expectChoice: true, stage: FLOW_STAGES.CATEGORY_CONFIRM });
      return;
    }

    if (flowStage === FLOW_STAGES.DETAIL) {
      const updatedFullText = conversationData.fullText
        ? `${conversationData.fullText} ${trimmedText}`
        : trimmedText;
      const summary = generateSummary(updatedFullText, '', conversationData.category);
      addDebugLog('요약 생성', summary);
      setConversationData(prev => ({
        ...prev,
        fullText: updatedFullText,
        summary
      }));
      setFlowStage(FLOW_STAGES.SUMMARY_CONFIRM);
      const response = `민원 내용을 다음과 같이 정리했습니다: ${summary}\n이 내용이 맞습니까? 예 또는 아니오로 답해주세요.`;
      speakAndDisplay(response, { expectChoice: true, stage: FLOW_STAGES.SUMMARY_CONFIRM });
      return;
    }

    addDebugLog('예상치 못한 입력 단계', flowStage);
  };

  // 선택 음성 처리
  const handleChoice = async (isYes) => {
    setScreen('processing');
    setChatHistory(prev => [...prev, { speaker: 'user', text: isYes ? '예' : '아니오' }]);
    addDebugLog('사용자 선택', { stage: flowStage, choice: isYes ? '예' : '아니오' });

    if (flowStage === FLOW_STAGES.CATEGORY_CONFIRM) {
      if (isYes) {
        setFlowStage(FLOW_STAGES.DETAIL);
        const prompt = '이제 민원 내용을 자세히 말씀해 주세요. 위치, 시간, 어떤 불편을 겪으셨는지 알려주시면 됩니다.';
        speakAndDisplay(prompt, { afterSpeech: () => startRecording(), stage: FLOW_STAGES.DETAIL });
      } else {
        setConversationData(createInitialConversationState());
        setFlowStage(FLOW_STAGES.CATEGORY);
        const prompt = '어떤 유형의 민원인지 다시 말씀해 주시면 분류해 드릴게요.';
        speakAndDisplay(prompt, { afterSpeech: () => startRecording(), stage: FLOW_STAGES.CATEGORY });
      }
      return;
    }

    if (flowStage === FLOW_STAGES.SUMMARY_CONFIRM) {
      if (isYes) {
        setFlowStage(FLOW_STAGES.FIELD_REQUIREMENT);
        const question = '현장 조사나 담당자 방문이 필요한 민원인가요? 예 또는 아니오로 답해주세요.';
        speakAndDisplay(question, { expectChoice: true, stage: FLOW_STAGES.FIELD_REQUIREMENT });
      } else {
        setFlowStage(FLOW_STAGES.DETAIL);
        const prompt = '추가로 필요한 내용을 더 알려주세요. 시간, 위치, 불편 정도를 말씀해 주시면 다시 요약해 드릴게요.';
        speakAndDisplay(prompt, { afterSpeech: () => startRecording(), stage: FLOW_STAGES.DETAIL });
      }
      return;
    }

    if (flowStage === FLOW_STAGES.FIELD_REQUIREMENT) {
      const requiresVisit = isYes;
      const selectedGuide = guidanceLibrary[conversationData.category] || guidanceLibrary['기타'];
      const guideText = requiresVisit ? selectedGuide.visit : selectedGuide.documents;
      const followUp = `${guideText}\n\n지금 안내드린 내용으로 민원을 접수하고 담당 부서에 전달할까요? 예 또는 아니오로 답해주세요.`;
      setConversationData(prev => ({
        ...prev,
        requiresVisit,
        guidance: guideText
      }));
      setFlowStage(FLOW_STAGES.HANDOFF_CONFIRM);
      speakAndDisplay(followUp, { expectChoice: true, stage: FLOW_STAGES.HANDOFF_CONFIRM });
      return;
    }

    if (flowStage === FLOW_STAGES.HANDOFF_CONFIRM) {
      if (isYes) {
        await saveComplaint();
        const thanks = `${conversationData.agency || '담당 부서'}에 전달하겠습니다. 담당 부서에서 3일에서 5일 이내에 연락드릴 예정입니다. 이용해 주셔서 감사합니다.`;
        speakAndDisplay(thanks, {
          afterSpeech: () => {
            setScreen('thankyou');
            setTimeout(() => resetConversation(), 6000);
          },
          stage: FLOW_STAGES.HANDOFF_CONFIRM
        });
      } else {
        speakAndDisplay('민원 접수를 취소했습니다. 필요하시면 언제든 다시 말씀해 주세요.', {
          afterSpeech: () => resetConversation(),
          stage: FLOW_STAGES.HANDOFF_CONFIRM
        });
      }
      return;
    }
  };

  // 민원 저장
  const saveComplaint = async () => {
    const complaintData = {
      category: conversationData.category,
      agency: conversationData.agency,
      summary: conversationData.summary,
      fullText: conversationData.fullText,
      requiresVisit: conversationData.requiresVisit,
      guidance: conversationData.guidance,
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
    setScreen('home');
    setFlowStage(FLOW_STAGES.CATEGORY);
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
    await analyzeAndRespond(text);
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
              onClick={startRecording}
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
              <h2 className="text-4xl font-bold text-gray-800 mb-12">
                "예" 또는 "아니오"로 답해주세요
              </h2>
              <div className="flex justify-center gap-8">
                <button
                  onClick={() => handleChoice(true)}
                  className="bg-blue-500 text-white text-4xl font-bold py-12 px-20 rounded-3xl hover:bg-blue-600 transition-all shadow-xl"
                >
                  예
                </button>
                <button
                  onClick={() => handleChoice(false)}
                  className="bg-gray-500 text-white text-4xl font-bold py-12 px-20 rounded-3xl hover:bg-gray-600 transition-all shadow-xl"
                >
                  아니오
                </button>
              </div>
            </div>
            <p className="text-2xl text-gray-600">또는 말로 답하셔도 됩니다</p>
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