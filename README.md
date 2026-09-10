# Explainer Studio

Explainer Studio là hệ thống tạo video giải thích tự động bằng **AI + TTS + Remotion**, hỗ trợ nhiều template và custom template.

## Tính năng chính

- Tạo kịch bản video bằng AI
- Chỉnh sửa từng scene trước khi render
- Edge TTS và VieNeu-TTS
- Từ điển cách đọc từ chuyên ngành
- Nhiều template video và Custom Template Builder
- Upload font/background riêng
- Intro / Outro và thông tin kênh
- Quản lý Render Jobs
- Sửa, đổi tên, xóa và thử lại project
- Render MP4 1080x1920

## Port sử dụng

| Dịch vụ | Port |
|---|---:|
| Web UI | 8080 |
| Backend API | 8081 |
| Template Assets API | 8082 |

# Cài đặt trên Ubuntu Server mới

Khuyến nghị: Ubuntu Server 24.04 LTS, RAM tối thiểu 8 GB, có Internet và quyền sudo/root.

## Bước 1 - Update Ubuntu

```bash
sudo apt update
sudo apt upgrade -y
```

## Bước 2 - Cài Git

```bash
sudo apt install -y git
```

## Bước 3 - Clone Explainer Studio

```bash
cd /opt
sudo git clone https://github.com/NhanVPH2802/explainer-studio.git
```

## Bước 4 - Vào thư mục

```bash
cd /opt/explainer-studio
```

## Bước 5 - Chạy bộ cài tự động

```bash
sudo bash install.sh
```

Installer sẽ tự cài Node.js 20 nếu cần, FFmpeg, npm dependencies, kiểm tra source, tạo thư mục runtime, tạo systemd services và khởi động Web/Backend/Template Assets API.

# Truy cập

Xem IP server:

```bash
hostname -I
```

Mở:

```text
http://IP-SERVER:8080
```

Ví dụ: `http://192.168.1.155:8080`

# Cấu hình sau khi cài

Vào **Providers** để cấu hình AI Provider, API Key, model và VieNeu-TTS nếu sử dụng. Edge TTS không cần API Key.

Ví dụ VieNeu-TTS chạy trên server khác:

```text
http://192.168.1.154:8000
```

# Kiểm tra dịch vụ

```bash
systemctl status explainer-studio-web
systemctl status explainer-studio-backend
systemctl status explainer-template-assets
```

Cả 3 cần ở trạng thái `active (running)`.

Kiểm tra port:

```bash
ss -lntp | grep -E '8080|8081|8082'
```

# Restart dịch vụ

```bash
sudo systemctl restart explainer-studio-web
sudo systemctl restart explainer-studio-backend
sudo systemctl restart explainer-template-assets
```

# Xem log

```bash
journalctl -u explainer-studio-backend -f
journalctl -u explainer-studio-web -f
journalctl -u explainer-template-assets -f
```

# Kiểm tra tự khởi động

```bash
systemctl is-enabled explainer-studio-web
systemctl is-enabled explainer-studio-backend
systemctl is-enabled explainer-template-assets
```

Kết quả bình thường là `enabled`.

# Test sau khi cài trên Ubuntu trắng

1. Truy cập Web UI port 8080.
2. Kiểm tra Backend Online.
3. Cấu hình và test AI Provider.
4. Test Edge TTS.
5. Cấu hình/test VieNeu-TTS nếu sử dụng.
6. Test Từ điển cách đọc.
7. Tạo kịch bản ngắn.
8. Render bằng template mặc định.
9. Tạo Custom Template và upload font/background.
10. Render bằng Custom Template.
11. Reboot server và kiểm tra các service tự chạy.

# Thư mục cài đặt

```text
/opt/explainer-studio
```

# Bảo mật

Không đưa API Key, GitHub PAT, `.env`, video/audio render, logs, cache, backup hoặc dữ liệu bí mật của Provider lên GitHub.

# Phiên bản

**Explainer Studio v1.0.0**

Repository: `https://github.com/NhanVPH2802/explainer-studio`
