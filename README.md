# 🧓 Senior Chatbot

시니어(고령층) 사용자의 **민원 등록 → 조회 → 검토** 흐름을 지원하는 풀스택 프로젝트입니다.  
프런트엔드는 **React (CRA 기반)**, 백엔드는 **Node.js / Express**, 데이터베이스는 **PostgreSQL**을 사용합니다.  
백엔드는 REST API를 통해 프런트엔드가 사용할 수 있는 민원 데이터 CRUD 인터페이스를 제공합니다.

---

## 📁 프로젝트 구조

```text
.
├── backend          # Express 서버, DB 연결, 초기 스키마
├── frontend         # CRA로 만든 React 앱
└── README.md        # 프로젝트 문서 (본 문서)
```

---

## ✅ 사전 준비 사항

이 프로젝트를 실행하려면 아래 도구가 로컬에 설치되어 있어야 합니다.

- **Node.js 18+** (npm 포함)  
  - 설치 문서: https://nodejs.org  
- **PostgreSQL 13+**  
  - 설치 문서: https://www.postgresql.org/docs/  
- **Git**

공식 문서를 기준으로 작성했으며, OS별 설치 방식은 환경에 따라 다를 수 있습니다.  
Windows 환경에서 pgAdmin만 설치되어 있고 `psql` CLI가 없으면 일부 명령이 동작하지 않을 수 있습니다.

---

## 🐘 PostgreSQL 설치 및 초기 설정

아래는 “로컬 개발용”으로 PostgreSQL을 설치한 뒤, 이 프로젝트용 DB를 만드는 **표준적인 절차**입니다.  
운영 환경에서는 별도 계정 분리, 권한 최소화, 네트워크 접근제어가 필요합니다.

### 1. PostgreSQL 설치

운영체제별 개요입니다.

- **Windows**
  1. https://www.postgresql.org/download/windows/ 에서 최신 버전 설치 프로그램 다운로드
  2. 설치 시 `postgres` 슈퍼유저 비밀번호 지정
  3. pgAdmin도 함께 설치하면 GUI로 확인 가능

- **macOS**
  - Homebrew 사용 (권장):
    ```bash
    brew install postgresql
    brew services start postgresql
    ```
  - 또는 PostgresApp 사용

- **Ubuntu / Debian**
  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
  ```

---

### 2. PostgreSQL 서비스 상태 확인

```bash
# Linux / macOS (brew services일 수도 있음)
sudo systemctl status postgresql
```

Windows에서는 “Services(서비스)”에서 **postgresql-x.x** 가 실행 중인지 확인하거나,  
pgAdmin → Servers → PostgreSQL 인스턴스가 연결되는지 확인합니다.

---

### 3. psql 접속

```bash
# 방법 1: OS 계정과 같은 이름의 DB로 접속
psql

# 방법 2: 명시적으로 유저/DB 지정
psql -U postgres -d postgres
```

접속 후 프롬프트가 아래와 같이 보이면 성공입니다.

```text
psql (14.x)
Type "help" for help.

postgres=#
```

---

### 4. 애플리케이션용 DB/계정 생성

```sql
CREATE DATABASE senior_chatbot;
CREATE USER senior_user WITH PASSWORD 'change-this-password';
GRANT ALL PRIVILEGES ON DATABASE senior_chatbot TO senior_user;
```

---

### 5. 스키마 적용

```bash
psql -U senior_user -d senior_chatbot -f backend/database.sql
```

---

### 6. 스키마 적용 확인

```sql
\dt
\d complaints
SELECT * FROM complaints LIMIT 10;
```

---

## 🔐 백엔드 환경 변수 설정

```bash
cd backend
cp .env.example .env
```

`.env` 파일 예시:

```env
DB_USER=senior_user
DB_PASSWORD=change-this-password
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=senior_chatbot
PORT=5000
```

---

## 📦 의존성 설치

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## 🚀 애플리케이션 실행

```bash
# 백엔드
cd backend
npm run dev

# 프런트엔드
cd frontend
npm start
```

---

## 🧪 테스트

```bash
cd frontend
npm test
```

---

## 🔧 문제 해결 가이드

- **DB 연결 오류:** .env 자격 증명 확인, 서비스 실행 여부 확인  
- **포트 충돌:** PORT 값 변경  
- **의존성 문제:** `rm -rf node_modules package-lock.json && npm install`

---

## 🧭 기여 방법

```bash
git checkout -b feat/add-feature
# 수정 후
git push origin feat/add-feature
```

---

## 📚 참고 문서

- PostgreSQL: https://www.postgresql.org/docs/  
- Express: https://expressjs.com/  
- React CRA: https://create-react-app.dev/  
