# Senior Chatbot

Senior Chatbot 프로젝트는 시민 민원 등록, 조회, 검토 기능을 제공하는 React 기반 프론트엔드와 Node.js/Express 백엔드로 구성되어 있습니다. 백엔드는 PostgreSQL에 데이터를 저장하고, 프론트엔드에서 사용할 수 있는 REST API를 제공합니다.

## 사전 준비 사항
프로젝트를 실행하기 전에 다음 도구가 로컬 환경에 설치되어 있어야 합니다.

- **Node.js** 18 이상 (npm 포함)
- **PostgreSQL** 13 이상
- **Git**

## 저장소 구조

```
.
├── backend          # Express 서버와 데이터베이스 스크립트
├── frontend         # Create React App으로 생성한 React 애플리케이션
└── README.md        # 프로젝트 문서 (현재 파일)
```

## 시작하기

### 1. 저장소 클론
```bash
git clone https://github.com/<your-org>/senior-chatbot.git
cd senior-chatbot
```

### 2. 데이터베이스 설정
1. PostgreSQL에서 데이터베이스를 생성합니다. (기본 이름: `senior_chatbot`).
2. `backend/database.sql` 스크립트를 실행하여 스키마를 구성합니다.
   ```bash
   psql -U <your-db-user> -d senior_chatbot -f backend/database.sql
   ```

### 3. 백엔드 환경 변수 구성
로컬 디버깅 편의를 위해 기본 PostgreSQL 자격 증명이 들어 있는 `backend/.env` 파일을 저장소에 그대로 유지합니다. 다음 값으로 설정되어 있으니 필요 시 알맞게 수정하세요.

- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=senior_chatbot`
- `PORT=5000`
- `NODE_ENV=development`
- `ALLOWED_ORIGINS=http://localhost:3000`

운영 환경이나 다른 개발 PC에서는 이 파일을 직접 수정하거나, `backend/.env.example`을 복사하여 새로운 `.env`를 만들어 사용하면 됩니다.

### 4. 의존성 설치
백엔드와 프론트엔드의 패키지를 각각 설치합니다.
```bash
# 백엔드 의존성
cd backend
npm install

# 프론트엔드 의존성
cd ../frontend
npm install
```

### 5. 애플리케이션 실행
두 개의 터미널 세션을 열어 실행합니다.

**백엔드 (Express 서버):**
```bash
# 백엔드
cd backend
npm run dev   # nodemon을 사용하여 자동 재시작
# 또는 npm start로 일반 실행
```

**프론트엔드 (React 앱):**
```bash
cd frontend
npm start
```
프론트엔드 개발 서버는 [http://localhost:3000](http://localhost:3000)에서 실행되며, 포트 `5000`에서 동작하는 백엔드 API를 프록시합니다.

### 디버그 모드로 대화 흐름 확인

프론트엔드 화면 오른쪽 상단에서 **디버그 모드**를 켜면 음성 대신 텍스트로 챗봇과 대화를 시뮬레이션하면서 처리 로그를 확인할 수 있습니다.

1. `디버그 모드 OFF` 버튼을 눌러 `ON` 상태로 변경합니다.
2. 하단 "디버그 대화" 영역의 입력창에 민원 내용을 타이핑하고 **디버그 입력 전송** 버튼을 누릅니다.
3. 왼쪽 패널에서 사용자/어시스턴트의 대화가 순서대로 쌓이고, 오른쪽 패널에서는 분류·요약·저장 등 처리 단계가 JSON 형태로 기록됩니다.
4. `로그 초기화` 버튼으로 대화와 로그를 모두 초기화할 수 있으며, 일반 음성 녹음 흐름과 함께 사용해도 됩니다.

## 테스트

- **프론트엔드 테스트:** `frontend/` 디렉터리에서 `npm test`를 실행해 Create React App 테스트를 수행합니다.
- **백엔드:** 현재 자동화된 테스트는 없습니다. curl이나 Postman과 같은 도구로 엔드포인트를 수동 검증할 수 있습니다.

## 유용한 명령어

| 위치        | 명령어            | 설명                               |
|-------------|------------------|------------------------------------|
| `backend/`  | `npm run dev`     | nodemon으로 백엔드 실행            |
| `backend/`  | `npm start`       | nodemon 없이 백엔드 실행           |
| `frontend/` | `npm start`       | React 개발 서버 실행               |
| `frontend/` | `npm test`        | 프론트엔드 테스트 실행             |
| `frontend/` | `npm run build`   | 프로덕션용 번들 생성               |

## 문제 해결

- **데이터베이스 연결 오류:** `backend/.env`의 자격 증명을 다시 확인하고 데이터베이스가 실행 중인지 확인하세요.
- **포트 충돌:** `backend/.env`의 `PORT` 값을 변경하거나, Create React App이 지원하는 환경 변수를 사용하세요. (예: `PORT=3001 npm start`)
- **의존성 문제:** 문제가 발생한 패키지의 `node_modules` 디렉터리를 삭제하고 `npm install`로 재설치합니다.

## 기여 방법

1. `main` 브랜치에서 새 브랜치를 생성합니다.
2. 변경 사항을 구현하고 테스트합니다.
3. 변경 사항을 요약한 풀 리퀘스트를 생성해 제출합니다.
