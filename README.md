# Explainer Studio

Explainer Studio là hệ thống tạo video giải thích tự động bằng AI, TTS và Remotion.

## Chức năng chính

- Tạo kịch bản bằng AI
- Chỉnh sửa từng scene trước khi render
- Edge TTS
- VieNeu-TTS
- Từ điển cách đọc từ chuyên ngành
- Nhiều video template
- Custom Template Builder
- Upload font riêng
- Upload background riêng
- Intro / Outro và thông tin kênh
- Quản lý Render Jobs
- Sửa, đổi tên, xóa và thử lại project
- Render video MP4 1080x1920

## Port sử dụng

| Dịch vụ | Port |
|---|---:|
| Web UI | 8080 |
| Backend API | 8081 |
| Template Assets API | 8082 |

---

# Cài đặt trên Ubuntu Server mới

Khuyến nghị:

- Ubuntu Server 24.04 LTS
- RAM tối thiểu 8 GB
- Có kết nối Internet
- Có quyền sudo/root

## Bước 1 - Update Ubuntu

```bash
sudo apt update
sudo apt upgrade -y
