# HỮU NHÂN SHOP – bản khung (giai đoạn 1)

Website bán hàng chạy thật trên Netlify: giao diện tĩnh (`public/index.html`) + API serverless (`netlify/functions/api.mjs`)
+ lưu dữ liệu và ảnh bằng **Netlify Blobs** (dịch vụ lưu trữ của Netlify, không cần database riêng).

## Đã có
- Home (banner, dịch vụ, 5 BOX TỔNG, sản phẩm nổi bật, liên hệ), Product (tìm kiếm, lọc, sắp xếp, chi tiết, liên quan), Profile Admin riêng, Pay, thanh điều hướng mobile.
- Admin (`#/admin`): sản phẩm, 5 BOX (tên/link/bật-tắt), đơn hàng, khách hàng + xếp hạng, thống kê, website & profile, cấu hình ngân hàng/QR. Upload/xóa ảnh.
- Box chưa có link hiển thị "SẮP RA MẮT", không lỗi.
- Thanh toán: KHÔNG giả lập. Đơn chỉ thành "Đã thanh toán" khi Admin xác nhận tay hoặc webhook hợp lệ gọi `POST /api/webhook` (header `x-api-key` = `PAYMENT_WEBHOOK_KEY`, body `{"code":"<mã đơn>","amount":<số tiền>}`). Bạn cần đăng ký cổng như SePay/Casso rồi ánh xạ dữ liệu của họ sang dạng này.
- Ảnh: bạn tự upload trong Admin; chưa có ảnh thì hiện placeholder "HN". Thư mục `public/images` để sẵn.

## Biến môi trường (xem `.env.example`)
`ADMIN_PASSWORD`, `SESSION_SECRET` (≥32 ký tự ngẫu nhiên), `PAYMENT_WEBHOOK_KEY`.

## Chạy local
1. Cài Node 18+. `npm install`
2. Sao chép `.env.example` thành `.env`, điền giá trị.
3. `npx netlify dev` → mở http://localhost:8888 (Admin: http://localhost:8888/#/admin).

## Deploy Netlify
1. Tạo repo GitHub, `git init && git add . && git commit -m "init"`, `git remote add origin <url>`, `git push -u origin main`.
2. Netlify → Add new site → Import from Git → chọn repo (netlify.toml đã có cấu hình, không cần build command).
3. Site configuration → Environment variables → thêm 3 biến ở trên → Deploy.
4. Vào `/#/admin`, đăng nhập, điền ngân hàng/QR, ảnh, link 5 BOX.

## Cấu trúc dữ liệu (Netlify Blobs, store `hn-data`)
`settings` (object), `boxes` [{id,name,link,active}], `products` [{id,name,desc,price,sale,category,tag,qty,image}],
`orders` [{code,name,phone,items[{id,name,qty,price}],total,status,createdAt,paidAt}]. Ảnh ở store `hn-images`.

## Giới hạn của bản khung (làm ở giai đoạn sau)
- Đơn lưu chung một mảng: phù hợp shop nhỏ; shop lớn nên chuyển sang Postgres (Supabase/Neon).
- Giao diện là JS thuần để chạy nhanh; có thể chuyển sang Next.js + Tailwind khi cần.
- Chưa tự kiểm tra trên Netlify thật: hãy deploy và thử đủ luồng (tạo đơn, Admin, upload ảnh).
