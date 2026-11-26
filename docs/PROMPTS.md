# Промпти для зображень, створених генеративним ШІ

Вимога курсу на «відмінно»: унікальні зображення, створені генеративним ШІ, з промптами у звіті.
Усі зображення витримано в стилі сайту «Цифровий паспорт»: **гравюра, як на банкнотах і в паспортах**.
Це тонкі паралельні штрихи, темно-синє чорнило на теплому кремовому папері. Такий стиль поєднується з
гільйошем, штампами й гравірованим портретом, які вже є на сайті, і однаково виглядає з усіма шістьма
палітрами профілю.

Генератор: Adobe Firefly (firefly.adobe.com, безкоштовні кредити) або Microsoft Designer / Bing Image Creator.
Промпти англійською, бо генератори краще розуміють англійську. Український зміст подано поруч.

## Як працювати (і що зберегти для звіту)

1. Вставте базовий промпт разом з описом людини або сцени.
2. Згенеруйте 3–4 варіанти й оберіть найкращий. Якщо результат не подобається, уточніть промпт. Наприклад:
   «more contrast», «less background», «hands not visible», «no color».
3. **Для промпт-паспорта звіту** зберігайте кожну ітерацію: скриншот екрана генератора з промптом і
   результатом, і одним реченням, що змінили й чому. Саме ітерації методичка називає розвитком думки.
4. Оригінали складіть у папку `звіт/ші-зображення/` (вона не йде в репозиторій) з іменами з таблиць нижче.
   Далі я зменшу їх, переведу у WebP і вбудую на сайт.

## 1. Портрети людей з прикладів (6 шт.)

Де з'являться: фото в профілях на сторінці «Приклади», у стосі прикладів і віялі бланків на головній.
Співвідношення сторін **4:5** (вертикальне), щонайменше 800×1000 px, PNG або JPG.

**Базовий промпт** (однаковий для всіх, щоб серія була цілісною):

```
Engraved portrait in the style of a banknote intaglio engraving, fine parallel line hatching and
cross-hatching, monochrome dark navy ink on warm cream paper, head and shoulders, facing the viewer,
calm friendly expression, plain light background, passport photo composition, centered, highly
detailed linework, [ОПИС ЛЮДИНИ]
```

Чого уникати (у Firefly — поле «Exclude», в інших генераторах допишіть у кінці «without …»):
`text, letters, watermark, frame, border, color, photorealistic skin, hands`

| Файл | Хто | Опис людини (вставити замість [ОПИС ЛЮДИНИ]) |
|---|---|---|
| `olena.png` | Олена Коваль, UX-дизайнерка, Львів | `a Ukrainian woman around 27 years old with shoulder-length wavy hair, wearing a simple knitted sweater` |
| `maksym.png` | Максим Гнатюк, frontend-розробник, студент | `a young Ukrainian man around 20 years old with short hair, wearing a hoodie` |
| `iryna.png` | Ірина Мельник, репетиторка англійської | `a Ukrainian woman around 32 years old with hair in a neat bun and round glasses, wearing a blouse` |
| `andrii.png` | Андрій Савчук, фотограф, Одеса | `a Ukrainian man around 35 years old with a short beard, wearing a denim shirt` |
| `sofiia.png` | Софія Бойко, маркетологиня | `a Ukrainian woman around 25 years old with long straight hair, wearing a blazer` |
| `nazar.png` | Назар Лисенко, аналітик даних | `a young Ukrainian man around 22 years old with short curly hair, wearing a collared shirt` |

Описи навмисно нейтральні: без професійних атрибутів (камера, ноутбук), бо їх зріже рамка фото 4:5.

## 2. Ілюстрація для сторінки «Про сервіс» (1 шт.)

Де: поруч із заголовком «Про сервіс». Співвідношення **3:2** (горизонтальне), щонайменше 1500×1000 px.
Файл: `about.png`.

```
Still life engraving of an open passport-style booklet and a few loose document pages on a desk,
a rubber stamp and a fountain pen beside them, one small round red stamp mark on a page,
intaglio line engraving, fine hatching, dark navy ink on warm cream paper, subtle guilloche
rosette pattern in the background, calm centered composition with empty space around the objects
```

Уникати: `text, readable letters, numbers, watermark, frame, people, hands, bright colors`

Українською: натюрморт-гравюра, розгорнутий «паспорт» і кілька аркушів на столі, поруч печатка й
ручка, на аркуші невеликий червоний відбиток печатки. Темно-синє чорнило на кремовому папері,
гільйошна розетка на тлі, багато вільного місця.

## 3. Необов'язково: сторінка 404 (1 шт.)

Зараз там штамп «Сторінку не знайдено». Ілюстрацію можна додати, якщо лишаться кредити.
Співвідношення **1:1**, файл `404.png`.

```
Engraving of a single lost document page drifting in the air above a few empty envelopes,
intaglio line engraving, fine hatching, dark navy ink on warm cream paper, minimalist composition,
lots of empty space
```

Уникати: `text, readable letters, numbers, watermark, frame, people`

## Що записати у звіт

- генератор і дату;
- кінцевий промпт кожного зображення (з цього файла або змінений вами);
- 1–2 ітерації з поясненням, що не сподобалось і як уточнили промпт;
- як зображення оброблено для сайту: зменшено, переведено у WebP, додано `alt`, `width`/`height`,
  `loading="lazy"`.
