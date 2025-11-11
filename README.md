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
`backend/` 폴더에 `.env` 파일을 생성합니다. `backend/.env.example`을 복사해 시작할 수 있습니다.
```bash
cd backend
cp .env.example .env
```
`.env` 파일에는 다음 변수를 설정합니다.

- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `PORT` (선택 사항, 기본값 `5000`)

보안을 위해 저장소에는 실제 `.env` 파일이 포함되어 있지 않으므로, 각 환경에서 `.env.example`을 복사해 개별 설정을 관리하세요.

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
