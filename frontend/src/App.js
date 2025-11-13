import React, { useState, useRef } from 'react';
import { Mic, Volume2, Home } from 'lucide-react';

const SeniorChatbot = () => {
  const [screen, setScreen] = useState('home'); // home, listening, processing, response, thankyou
  const [conversationData, setConversationData] = useState({
    category: '',
    agency: '',
    summary: '',
    fullText: ''
  });
  const [isListening, setIsListening] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [conversationStep, setConversationStep] = useState(0);
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
    addDebugLog('사용자 입력 수신', trimmedText);

    // 민원 분류
    const category = analyzeComplaint(trimmedText);
    const agency = getAgency(category);
    addDebugLog('분류 결과', { category, agency });

    let response = '';
    let nextStep = conversationStep;

    if (conversationStep === 0) {
      // 첫 질문 후
      response = `말씀하신 내용은 ${category} 관련 민원으로 ${agency}에서 담당하고 있습니다. 조금 더 자세히 설명해 주시겠습니까? 예를 들어, 정확한 위치나 언제부터 불편하셨는지 말씀해 주세요.`;
      nextStep = 1;
      setConversationData(prev => ({
        ...prev,
        category,
        agency,
        fullText: trimmedText
      }));
    } else if (conversationStep === 1) {
      // 추가 정보 수집 후
      const summary = generateSummary(conversationData.fullText, trimmedText, category);
      response = `네, 잘 알겠습니다. 말씀하신 내용을 정리하면, ${summary} 이 내용으로 민원을 접수하시겠습니까?`;
      nextStep = 2;
      setConversationData(prev => ({
        ...prev,
        fullText: prev.fullText + ' ' + trimmedText,
        summary
      }));
      addDebugLog('요약 생성', summary);
    }

    setConversationStep(nextStep);
    setCurrentQuestion(response);
    setScreen('response');
    setChatHistory(prev => [...prev, { speaker: 'assistant', text: response }]);
    addDebugLog('응답 출력', response);
    speak(response);

    // 응답 후 자동으로 추가 질문 여부 확인
    setTimeout(() => {
      if (nextStep < 2) {
        askForMore();
      } else {
        confirmSubmission();
      }
    }, response.length * 80); // 응답 시간에 따라 대기
  };

  // 추가 질문 여부 확인
  const askForMore = () => {
    speak('추가로 말씀하실 내용이 있으신가요? 있으시면 예, 없으시면 아니오 라고 말씀해 주세요.');
    setScreen('choice');
  };

  // 접수 확인
  const confirmSubmission = () => {
    speak('이대로 접수하시겠습니까? 접수하시려면 예, 취소하시려면 아니오 라고 말씀해 주세요.');
    setScreen('choice');
  };

  // 선택 음성 처리
  const handleChoice = async (isYes) => {
    setScreen('processing');
    
    if (conversationStep < 2) {
      if (isYes) {
        // 추가 질문 있음
        speak('말씀해 주세요.');
        addDebugLog('사용자 선택', { choice: '예', step: conversationStep });
        setTimeout(() => startRecording(), 2000);
      } else {
        // 추가 질문 없음 - 민원 요약 및 접수 확인
        const summary = generateSummary(conversationData.fullText, '', conversationData.category);
        setConversationData(prev => ({ ...prev, summary }));
        setConversationStep(2);

        const response = `말씀하신 내용을 정리하면, ${summary} 이 내용으로 민원을 접수하시겠습니까?`;
        setCurrentQuestion(response);
        setScreen('response');
        setChatHistory(prev => [...prev, { speaker: 'assistant', text: response }]);
        addDebugLog('요약 재확인', summary);
        speak(response);

        setTimeout(() => confirmSubmission(), response.length * 80);
      }
    } else {
      if (isYes) {
        // 민원 접수
        await saveComplaint();
        setScreen('thankyou');
        addDebugLog('사용자 선택', { choice: '예', step: conversationStep });
        speak('민원이 정상적으로 접수되었습니다. 담당 부서에서 3일에서 5일 이내에 연락드리겠습니다. 이용해 주셔서 감사합니다.');
        
        setTimeout(() => {
          resetConversation();
        }, 8000);
      } else {
        // 취소
        setScreen('thankyou');
        addDebugLog('사용자 선택', { choice: '아니오', step: conversationStep });
        speak('민원 접수가 취소되었습니다. 이용해 주셔서 감사합니다.');
        setTimeout(() => resetConversation(), 5000);
      }
    }
  };

  // 민원 저장
  const saveComplaint = async () => {
    const complaintData = {
      category: conversationData.category,
      agency: conversationData.agency,
      summary: conversationData.summary,
      fullText: conversationData.fullText,
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
    setConversationStep(0);
    setConversationData({
      category: '',
      agency: '',
      summary: '',
      fullText: ''
    });
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