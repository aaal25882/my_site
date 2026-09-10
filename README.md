# aaal258.ir

سایت شخصی امیرعلی ارجمند لاری، به‌همراه سامانه‌ی واسطه‌ی خرید از چین. روی GitHub Pages منتشر می‌شود.

## صفحات
- `index.html`: سایت شخصی فعلی و لینک ورود به سامانه
- `china.html`: معرفی سرویس و ثبت سفارش
- `auth.html`: ورود و ثبت‌نام ایمیلی و Google
- `dashboard.html`: بررسی Session، نمایش نقش و وضعیت تأیید کاربر

## ساختار پوشه‌ها
```
index.html            صفحه‌ی اصلی
china.html · auth.html · dashboard.html
css/
  site.css            استایل صفحه‌ی اصلی
  style.css           استایل مشترک صفحه‌های سامانه
  china.css · auth.css · dashboard.css
js/
  site.js             رفتار صفحه‌ی اصلی (شمارنده‌ها، منو، نمایش تدریجی)
  theme.js · common.js · ui-motion.js     مشترک
  supabase-config.js  تنظیمات عمومی Supabase
  china-interactions.js · auth.js · dashboard.js · order-pricing.js
assets/               لوگو و رزومه
supabase/             اسکیما، مهاجرت و Edge Function
```

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

## به‌روزرسانی دسترسی سایت و مدارک حمل‌کننده

در پنل کاربری، لینک‌های صفحه اصلی، معرفی سامانه و خود پنل در نوار کناری قرار گرفته‌اند.
مدارک حمل‌کنندگان در Storage خصوصی با نام `traveler-documents` ذخیره می‌شوند. فقط صاحب مدرک و مدیر امکان مشاهده فایل را دارند.

پس از جایگزینی فایل‌ها، محتوای جدید `supabase/schema.sql` را دوباره در SQL Editor اجرا کنید. اجرای موفق پیام `Success. No rows returned` نشان می‌دهد.


## Silent order pricing
The public calculator UI was removed. Pricing now runs silently during order submission through `js/order-pricing.js`, while the final amount remains hidden from buyers until the order reaches an approved workflow status.
