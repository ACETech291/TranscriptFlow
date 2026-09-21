# 📺 TranscriptFlow - YouTube Transcript Extractor

![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Llama_3_70B-f55036?style=for-the-badge)

TranscriptFlow là một ứng dụng Web hiện đại giúp bạn trích xuất, dọn dẹp, và tóm tắt phụ đề (transcript) từ bất kỳ video YouTube nào một cách dễ dàng. Giao diện được thiết kế theo phong cách Glassmorphism sang trọng (Midnight Theme), mang đến trải nghiệm UI/UX cao cấp chuẩn SaaS.

---

## ✨ Tính năng nổi bật

- **🔍 Trích xuất nhanh chóng:** Dán URL YouTube và nhận ngay phụ đề gốc kèm theo mốc thời gian (timeline).
- **🎯 Nhấn để tua (Click-to-seek):** Đồng bộ hóa hoàn hảo. Chỉ cần nhấn vào bất kỳ dòng phụ đề nào, video sẽ tự động tua đến đúng giây đó.
- **✨ Tự động cuộn (Auto-scroll):** Phụ đề sẽ tự động cuộn theo tiến trình phát của video.
- **🧠 Dọn dẹp bằng AI (Smart Grouping):** Xóa bỏ các từ thừa (uh, um), tự động ngắt câu, và gộp các mảng văn bản vụn vặt thành các đoạn văn hoàn chỉnh dễ đọc nhưng vẫn giữ nguyên mốc thời gian.
- **📝 Tóm tắt AI (Summarize):** Đọc trọn nội dung chính của video dài hàng giờ chỉ trong vài giây.
- **🔑 BYOK (Bring Your Own Key):** Hỗ trợ nhập mã API Groq của riêng bạn để sử dụng AI hoàn toàn miễn phí, với tốc độ xử lý siêu tốc từ Llama 3 70B.
- **🎨 Giao diện Glassmorphism:** Thiết kế mượt mà, hỗ trợ hiệu ứng chuyển cảnh, dark mode (Midnight) thời thượng lấy cảm hứng từ Linear và Vercel.

---

## 🛠 Công nghệ sử dụng

- **Frontend:** React 18, Vite
- **Styling:** Tailwind CSS (với các biến CSS tùy chỉnh)
- **Video Player:** `react-player`
- **Backend/API:**
  - YouTube Data API (fetch phụ đề)
  - Groq Cloud API (xử lý LLM: `llama3-70b-8192`)
- **Khác:** Biểu tượng Heroicons, Fetch API.

---

## 🚀 Hướng dẫn cài đặt

Bạn cần cài đặt Node.js (phiên bản 16 trở lên) trên máy tính.

1. **Clone repository:**
   ```bash
   git clone https://github.com/yourusername/youtube-transcript-extractor.git
   cd youtube-transcript-extractor
   ```

2. **Cài đặt các gói thư viện (Dependencies):**
   ```bash
   npm install
   ```

3. **Khởi chạy máy chủ phát triển (Development Server):**
   ```bash
   npm run dev
   ```

4. **Mở trình duyệt:** Truy cập vào `http://localhost:5173`. Ứng dụng đã sẵn sàng!

---

## 🤖 Hướng dẫn sử dụng tính năng AI (Groq API)

Ứng dụng sử dụng mô hình AI Llama 3 70B (thông qua Groq) để tóm tắt và dọn dẹp phụ đề. Việc dùng Groq hoàn toàn miễn phí và siêu tốc độ, nhưng bạn cần tự tạo một mã API (API Key) riêng:

1. Truy cập trang quản lý mã API của Groq: [Groq Console](https://console.groq.com/keys).
2. Đăng nhập hoặc đăng ký tài khoản miễn phí.
3. Nhấn nút **"Create API Key"** và đặt tên cho key của bạn.
4. Sao chép đoạn mã vừa tạo (bắt đầu bằng `gsk_...`).
5. Trở lại ứng dụng TranscriptFlow, nhấn vào biểu tượng bánh răng **Cài đặt AI** (góc trên cùng bên phải).
6. Dán mã vào ô **Mã Groq API** và nhấn **Lưu mã**.
7. Bây giờ bạn có thể trải nghiệm tính năng "Dọn dẹp" và "Tóm tắt AI" thoải mái!

*(Lưu ý: Mã API của bạn được lưu an toàn 100% trên `localStorage` của trình duyệt và không bao giờ được gửi tới bất kỳ máy chủ nào khác ngoài Groq).*
