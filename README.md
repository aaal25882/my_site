# سامانه خرید از چین

این مخزن شامل سایت شخصی امیرعلی ارجمند و نسخه اولیه سامانه واسطه خرید از چین است.

## صفحات
- `index.html`: سایت شخصی فعلی و لینک ورود به سامانه
- `china.html`: معرفی سرویس و محاسبه‌گر کارمزد
- `auth.html`: ورود و ثبت‌نام ایمیلی و Google
- `dashboard.html`: بررسی Session، نمایش نقش و وضعیت تأیید کاربر

## اتصال Supabase
تنظیمات عمومی فرانت‌اند در `js/supabase-config.js` قرار دارند.

فقط موارد عمومی زیر مجازند:
- Project URL
- Publishable key یا anon public key

هرگز `service_role`، Secret key، JWT secret یا رمز دیتابیس را در GitHub قرار ندهید.

## راه‌اندازی دیتابیس
1. در Supabase وارد `SQL Editor` شوید.
2. یک Query جدید بسازید.
3. محتوای `supabase/schema.sql` را اجرا کنید.
4. در `Table Editor > profiles` ساخته‌شدن جدول را بررسی کنید.

قواعد فعلی:
- خریدار با وضعیت `approved` ساخته می‌شود.
- مسافر با وضعیت `pending` ساخته می‌شود.
- کاربر عادی نمی‌تواند نقش یا وضعیت تأیید خود را تغییر دهد.
- نقش `admin` از ثبت‌نام عمومی ساخته نمی‌شود.

## URLهای احراز هویت
در `Authentication > URL Configuration`:

Site URL:

```text
https://aaal258.ir
```

Redirect URLs:

```text
https://aaal258.ir/**
https://aaal258.ir/dashboard.html
http://localhost:5500/**
http://127.0.0.1:5500/**
```

## ورود Google
در Google Cloud یک OAuth Client از نوع Web Application بسازید.

Authorized JavaScript origins:

```text
https://aaal258.ir
```

Authorized redirect URI باید دقیقاً Callback نمایش‌داده‌شده در تنظیم Google Provider پروژه Supabase باشد؛ معمولاً:

```text
https://iowhgknspzchsywanlrl.supabase.co/auth/v1/callback
```

سپس Client ID و Client Secret را در:

`Supabase > Authentication > Providers > Google`

وارد کنید.

در نسخه فعلی، ورود Google با نقش امن پیش‌فرض `buyer` انجام می‌شود. ثبت‌نام مسافر فعلاً باید از فرم ایمیلی انجام شود تا نقش `traveler` به Trigger ارسال شود.
