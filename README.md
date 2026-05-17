# نواة — Portfolio Management Site

موقع ثابت لإدارة وتصميم المحافظ الاستثمارية، جاهز للنشر على GitHub Pages أو أي خادم ملفات ثابتة.

## الملفات

- `index.html`: الصفحة الرئيسية.
- `builder.html`: لوحة بناء المحفظة وتخصيص الأصول.
- `risk.html`: اختبار تحمل المخاطر.
- `learn.html`: المركز التعليمي.
- `dashboard.html`: صفحة الحساب والمحافظ المحفوظة.
- `styles.css`: تنسيقات الواجهة المتجاوبة.
- `app.js`: منطق بناء المحفظة والرسم البياني.
- `auth-ui.js`, `portfolio-db.js`: ربط Supabase للمصادقة وحفظ المحافظ.
- `nawa-logo.png`: الشعار.

## التشغيل المحلي

يمكن فتح `index.html` مباشرة، والأفضل تشغيل الموقع عبر خادم محلي بسيط:

```bash
python -m http.server 8080
```

ثم افتح:

```text
http://localhost:8080/
```

## النشر على GitHub Pages

1. ارفع محتويات هذا المجلد إلى مستودع GitHub.
2. من إعدادات المستودع افتح `Settings > Pages`.
3. اختر `Deploy from a branch`.
4. اختر الفرع `main` والمجلد `/root`.
5. بعد النشر سيكون الرابط غالباً:

```text
https://ghassanalshyib-commits.github.io/nawa-site-pages/
```

الرابط الحالي للنسخة المنشورة هو `https://ghassanalshyib-commits.github.io/nawa-site-pages/`.

## إعداد Supabase

قبل تجربة تسجيل الدخول وحفظ المحافظ:

1. نفذ `supabase-portfolios.sql` داخل Supabase SQL Editor.
2. نفذ `supabase-security-hardening.sql`.
3. في `Authentication > URL Configuration` أضف رابط GitHub Pages كـ `Site URL`.
4. أضف روابط التحويل التالية:

```text
https://ghassanalshyib-commits.github.io/nawa-site-pages/**
https://ghassanalshyib-commits.github.io/nawa-site-pages/reset-password.html
```

الموقع يستخدم `anon public key` فقط داخل الواجهة. لا تضف `service_role key` إلى ملفات الموقع.

## ملاحظات الإطلاق

ملفات الروابط الداخلية مضبوطة لتعمل داخل مسار مستودع GitHub Pages الفرعي، و`robots.txt` و`sitemap.xml` يستخدمان رابط النشر الحالي.

المحتوى تعليمي ولا يمثل توصية استثمارية.
