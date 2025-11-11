const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// PostgreSQL 연결 설정
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'senior_chatbot',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// DB 연결 테스트
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DB 연결 실패:', err.stack);
  } else {
    console.log('✅ PostgreSQL 연결 성공');
    release();
  }
});

// ========== API 엔드포인트 ==========

// 1. 민원 생성 (POST)
app.post('/api/complaints', async (req, res) => {
  const { category, agency, summary, fullText, status, contactInfo, location } = req.body;

  try {
    // 민원 데이터 삽입
    const complaintResult = await pool.query(
      `INSERT INTO complaints (category, agency, summary, full_text, status, contact_info, location) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [category, agency, summary, fullText, status || '접수완료', contactInfo, location]
    );

    const complaintId = complaintResult.rows[0].id;

    // 대화 로그가 있으면 삽입
    if (req.body.chatLogs && req.body.chatLogs.length > 0) {
      for (const log of req.body.chatLogs) {
        await pool.query(
          `INSERT INTO chat_logs (complaint_id, speaker, message) 
           VALUES ($1, $2, $3)`,
          [complaintId, log.speaker, log.message]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: '민원이 성공적으로 저장되었습니다',
      data: complaintResult.rows[0]
    });

  } catch (error) {
    console.error('민원 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '민원 저장 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 2. 민원 목록 조회 (GET)
app.get('/api/complaints', async (req, res) => {
  const { category, status, startDate, endDate, limit = 100, offset = 0 } = req.query;

  try {
    let query = 'SELECT * FROM complaints WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('민원 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '민원 조회 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 3. 특정 민원 상세 조회 (GET)
app.get('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 민원 정보
    const complaintResult = await pool.query(
      'SELECT * FROM complaints WHERE id = $1',
      [id]
    );

    if (complaintResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 민원을 찾을 수 없습니다'
      });
    }

    // 대화 로그
    const chatLogsResult = await pool.query(
      'SELECT * FROM chat_logs WHERE complaint_id = $1 ORDER BY timestamp',
      [id]
    );

    res.json({
      success: true,
      data: {
        complaint: complaintResult.rows[0],
        chatLogs: chatLogsResult.rows
      }
    });

  } catch (error) {
    console.error('민원 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '민원 조회 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 4. 민원 상태 업데이트 (PATCH)
app.patch('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE complaints SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 민원을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      message: '민원 상태가 업데이트되었습니다',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('민원 상태 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '상태 업데이트 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 5. 통계 조회 (GET)
app.get('/api/statistics', async (req, res) => {
  try {
    // 전체 통계
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM complaints'
    );

    // 카테고리별 통계
    const categoryStats = await pool.query(
      'SELECT * FROM complaint_statistics ORDER BY total_count DESC'
    );

    // 일별 통계 (최근 30일)
    const dailyStats = await pool.query(
      `SELECT * FROM daily_complaint_stats 
       WHERE date >= CURRENT_DATE - INTERVAL '30 days' 
       ORDER BY date DESC`
    );

    // 상태별 통계
    const statusStats = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM complaints 
       GROUP BY status`
    );

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].total),
        byCategory: categoryStats.rows,
        byStatus: statusStats.rows,
        daily: dailyStats.rows
      }
    });

  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 6. 민원 삭제 (DELETE)
app.delete('/api/complaints/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM complaints WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 민원을 찾을 수 없습니다'
      });
    }

    res.json({
      success: true,
      message: '민원이 삭제되었습니다',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('민원 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '민원 삭제 중 오류가 발생했습니다',
      error: error.message
    });
  }
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '서버가 정상 작동 중입니다' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`📊 API 엔드포인트: http://localhost:${PORT}/api`);
});

// 에러 핸들링
process.on('SIGTERM', () => {
  console.log('👋 서버 종료 중...');
  pool.end(() => {
    console.log('✅ DB 연결 종료');
    process.exit(0);
  });
});