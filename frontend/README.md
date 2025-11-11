# 프로젝트 실행방법
# 프론트엔드

# 1. 새로 폴더 만들기
mkdir senior-chatbot
cd senior-chatbot

# 1. 새로 프로젝트 생성
npx create-react-app frontend

# 2. 폴더로 이동
cd senior-chatbot/frontend

# 3. lucide-react 설치
npm install lucide-react

# 4. 실행
npm start

# 백엔드 (senior-chatbot 프로젝트 폴더 내)
mkdir backend
cd backend

# 1. Node.js 프로젝트 초기화
npm init -y

# 2. 필요한 패키지 설치
npm install express pg cors dotenv body-parser
npm install -D nodemon

# node.js 버전
v24.11.0