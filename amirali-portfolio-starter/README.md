# نسخه اول سامانه خرید از چین

این پوشه شامل سایت شخصی قبلی و نسخه اولیه بخش جدید خرید از چین است.

## صفحات
- `index.html`: سایت شخصی فعلی با لینک به بخش جدید
- `china.html`: معرفی سرویس و محاسبه‌گر کارمزد
- `auth.html`: ورود و ثبت‌نام
- `dashboard.html`: صفحه موقت بعد از ورود

## اتصال Supabase
فایل `js/supabase-config.js` را باز کنید و فقط این دو مقدار را جایگزین کنید:
- Project URL
- Publishable key یا anon public key

هرگز Database Password، Secret key یا service_role key را در GitHub قرار ندهید.

## راه‌اندازی ورود گوگل
در Supabase مسیر Authentication > Providers > Google را فعال کنید.
سپس Client ID و Client Secret ساخته‌شده در Google Cloud را وارد کنید.
آدرس سایت و Redirect URL باید در Authentication > URL Configuration ثبت شوند.

## ساخت جدول اولیه
کد داخل `supabase/schema.sql` را از طریق Supabase > SQL Editor اجرا کنید.

## محاسبه کارمزد
نسخه اولیه از بیشترین مقدار بین موارد زیر استفاده می‌کند:
1. چهار درصد ارزش کالا
2. سهم وزنی از درآمد هدف سفر
3. حداقل کارمزد سفارش

فرمول باید پس از جمع‌آوری داده واقعی سفر، گمرک، زمان خرید و نرخ پذیرش سفارش بازتنظیم شود.
