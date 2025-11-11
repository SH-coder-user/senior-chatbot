-- 데이터베이스 생성 (pgAdmin 또는 psql에서 실행)
-- CREATE DATABASE senior_chatbot;

-- 데이터베이스 연결 후 아래 스키마 실행

-- 민원 테이블
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(50) NOT NULL,
    agency VARCHAR(100) NOT NULL,
    summary TEXT NOT NULL,
    full_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT '접수완료',
    contact_info VARCHAR(100),
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 대화 로그 테이블
CREATE TABLE IF NOT EXISTS chat_logs (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL,  -- 'user' 또는 'assistant'
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 민원 카테고리별 인덱스 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_timestamp ON complaints(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_logs_complaint_id ON chat_logs(complaint_id);

-- 민원 통계 뷰 (대시보드용)
CREATE OR REPLACE VIEW complaint_statistics AS
SELECT 
    category,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = '접수완료' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = '처리중' THEN 1 END) as processing_count,
    COUNT(CASE WHEN status = '완료' THEN 1 END) as completed_count,
    agency
FROM complaints
GROUP BY category, agency;

-- 일별 민원 통계 뷰
CREATE OR REPLACE VIEW daily_complaint_stats AS
SELECT 
    DATE(timestamp) as date,
    category,
    COUNT(*) as count
FROM complaints
GROUP BY DATE(timestamp), category
ORDER BY date DESC;

-- 샘플 데이터 삽입 (테스트용)
INSERT INTO complaints (category, agency, summary, full_text, status) VALUES
('시설', '도시관리과', '공원 가로등 고장', '우리 동네 공원에 가로등이 고장나서 밤에 너무 어두워요', '접수완료'),
('교통', '교통행정과', '버스 정류장 벤치 필요', '버스 정류장에 앉을 곳이 없어서 불편합니다', '처리중'),
('복지', '복지정책과', '노인 복지 수당 문의', '노인 복지 수당 신청 방법을 알고 싶습니다', '완료'),
('환경', '환경위생과', '쓰레기 무단투기 신고', '우리 동네에 쓰레기가 계속 버려지고 있습니다', '접수완료');

-- 샘플 대화 로그
INSERT INTO chat_logs (complaint_id, speaker, message) VALUES
(1, 'user', '공원 가로등이 고장났어요'),
(1, 'assistant', '어느 공원인지 말씀해 주시겠어요?'),
(1, 'user', '중앙공원이요'),
(1, 'assistant', '민원이 접수되었습니다');

-- 테이블 확인 쿼리
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 데이터 확인
SELECT * FROM complaints;
SELECT * FROM complaint_statistics;
SELECT * FROM daily_complaint_stats;