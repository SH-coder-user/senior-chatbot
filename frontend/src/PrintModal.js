import React from 'react';
import './PrintModal.css';

// Mock data similar to what the parent component would pass
const mockData = {
  agency: '도시관리과',
  detailCategory: '시설',
  summary: '공원 가로등 고장 신고',
  guidance: '시설 민원은 고장 위치, 발견 시간, 근처 건물명을 메모해 두시면 접수 즉시 처리 순서를 정할 수 있습니다. 가능한 경우 사진 한 장을 함께 준비해 주세요.',
};

const PrintModal = ({ conversationData = mockData, onClose }) => {
  const {
    agency,
    detailCategory,
    summary,
    guidance,
  } = conversationData;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">민원 접수 내용 확인</h2>
          <button onClick={onClose} className="close-button" aria-label="닫기">&times;</button>
        </div>
        <div className="modal-body" id="printable-area">
          <h3 className="section-title">기본 정보</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">담당 부서</span>
              <span className="info-value">{agency || '배정중'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">민원 분류</span>
              <span className="info-value">{detailCategory || '기타'}</span>
            </div>
          </div>

          <h3 className="section-title">민원 내용 요약</h3>
          <p className="summary-text">
            {summary || '내용 없음'}
          </p>

          <h3 className="section-title">처리 절차 및 필요 서류 안내</h3>
          <p className="guidance-text">
            {guidance || '별도 안내 없음'}
          </p>

          <div className="contact-info">
            <h4 className="contact-title">추가 문의</h4>
            <p>더 궁금한 점이 있으시면 아래 연락처로 문의해 주세요.</p>
            <p><strong>부서:</strong> {agency || '민원봉사과'}</p>
            <p><strong>연락처:</strong> 02-1234-5678 (평일 09:00 ~ 18:00)</p>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="footer-button cancel">닫기</button>
          <button onClick={handlePrint} className="footer-button print">인쇄하기</button>
        </div>
      </div>
    </div>
  );
};

export default PrintModal;
