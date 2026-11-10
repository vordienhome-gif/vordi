# МойСклад çalışma prensibi ve Vordi karşılığı

Bu belge, МойСклад'ın nasıl çalıştığını ve Vordi platformunun bu yapıyı nasıl karşıladığını özetler. Kaynak: МойСклад'ın kamuya açık arayüzü, yardım ve JSON API 1.2 yapısı ile ilgili genel bilgi. (Bu çalışma ortamından МойСклад sitelerine erişim kapalıydı; ayrıntılar, sizin МойСклад hesabınızdan veri çekme aşamasında gerçek veriyle doğrulanacak.)

> Vordi, МойСклад'ın kodunu, tasarımını veya markasını kullanmaz. Aynı türden iş akışlarını sıfırdan uygular.

## 1. Temel fikir: her şey belgedir

МойСклад'da stok, cari bakiye ve kasa bakiyesi elle yazılan sayılar değildir. Hepsi **belgelerden** hesaplanır:

- Her işlem bir belgedir: Приёмка (mal kabul), Отгрузка (sevkiyat), Перемещение (transfer), Входящий платёж (gelen ödeme)…
- Belgenin **проведён (işlendi)** işareti vardır. Yalnızca işlenmiş belgeler stoğu, cariyi ve parayı etkiler. Taslak belge hiçbir şeyi değiştirmez.
- Belge geri alınırsa (işaret kaldırılır veya silinir) etkisi de kalkar.
- Belgeler birbirinden türetilir (**на основании**): Заказ покупателя → Отгрузка → Входящий платёж. Bağlı belgeler zinciri her belgede görünür.

**Vordi:** Aynı ilke `packages/domain/src/posting.ts` içinde uygulanır. İşlenen belge üç **değişmez deftere** kayıt yazar: stok hareketleri, cari hareketleri (взаиморасчёты), para hareketleri. Raporlar bu defterlerden hesaplanır.

## 2. Bölümler ve belge türleri

| МойСклад bölümü | Belgeler | Vordi durumu |
|---|---|---|
| **Закупки** (Alış) | Заказ поставщику, Счёт поставщика, Приёмка, Возврат поставщику, Счёт-фактура полученный | ✅ sipariş, счёт, приёмка, iade · ⏳ счёт-фактура |
| **Продажи** (Satış) | Заказ покупателя, Счёт покупателю, Отгрузка, Возврат покупателя, Счёт-фактура выданный, Прайс-лист, Предоплата | ✅ sipariş, счёт, отгрузка, iade · ⏳ счёт-фактура, прайс-лист, предоплата |
| **Товары** (Ürünler) | Товары, Услуги, Комплекты, Модификации, Серии, Группы, Штрихкоды, Типы цен | ✅ ürün, hizmet, modifikasyon, grup, barkod, fiyat türü · ⏳ komple (set), seri/parti |
| **Склад** (Depo) | Оприходование, Списание, Перемещение, Инвентаризация, Внутренний заказ | ✅ hepsi (iç sipariş hariç) · ⏳ внутренний заказ |
| **Деньги** (Para) | Входящий/Исходящий платёж, Приходный/Расходный ордер, Движение денежных средств, Прибыли и убытки | ✅ ödeme ve kasa fişleri · ⏳ ДДС ve ПиУ raporları, gider kalemleri |
| **Розница** (Perakende) | Точки продаж, Смены, Продажи, Возвраты, Внесения, Выплаты | ✅ perakende satış/iade belgesi · ⏳ kasa noktası, vardiya, para giriş/çıkış, kasa uygulaması |
| **Контрагенты** (Cariler) | Kartlar, gruplar/etiketler, statüler, Взаиморасчёты | ✅ kart, etiket, fiyat türü, borç limiti, bakiye · ⏳ ekstre (akt сверки) |
| **Маркировка** | Честный знак: kod sipariş, ввод в оборот, вывод из оборота, kodlu kabul/satış | ✅ kodlu belge satırı, mükerrer satış engeli · ⏳ ГИС МТ (True API) bağlantısı, kod siparişi, ЛМ ЧЗ |
| **Производство** | Техкарты, Техоперации | ⏳ sonraki aşama |
| **Отчёты** | Остатки, Обороты, Прибыльность, Взаиморасчёты, Показатели, Серийные номера | ✅ остатки (stok/rezerv/beklenen/kullanılabilir/FIFO değer), прибыльность (FIFO), взаиморасчёты · ⏳ обороты, göstergeler paneli |
| **Сотрудники** | Kullanıcılar, roller ve haklar, görevler | ✅ çalışan, rol, depo kısıtı · ⏳ ayrıntılı haklar, görevler, mesai/vardiya |
| **Настройки** | Юрлица (kendi şirketleriniz), Склады, Шаблоны печатных форм, Ценники и этикетки, Статусы, Доп. поля | ✅ depo · ⏳ tüzel kişiler, yazdırma şablonları, etiket tasarımı, özel statüler, ek alanlar (ürün kartında `attributes` hazır) |
| **Интеграции** | Интернет-магазины, маркетплейсы, ККТ, ЭДО, банки, JSON API, webhook | ⏳ (Vordi'deki Ozon/WB/YM/InSales adaptörleri taşınacak) |

## 3. Ürün yapısı

- **Товар** (ürün) — ad, artikul, kod, birim, KDV, ürün grubu, ek alanlar, markalama türü, alış fiyatı, minimum stok.
- **Модификация** (varyant) — bir ürünün özellik kombinasyonu: "Размер: M, Цвет: Синий". Adı özelliklerden oluşur. Stok ve barkod **modifikasyon bazında** tutulur.
- **Штрихкод** — bir modifikasyonun birden çok barkodu olabilir (EAN-13, GTIN, Code128). Barkodu olmayan ürüne sistem "2" ile başlayan iç EAN-13 üretir (`internalEan13`).
- **Типы цен** — Розничная, Оптовая, kampanya fiyatları… Her modifikasyonun her fiyat türünde ayrı fiyatı olabilir. Cari kartına fiyat türü atanır; toptan müşteri otomatik toptan fiyatı görür.

**Vordi:** Varyantı olmayan ürün de tek bir (adsız) varyantla tutulur; böylece stok, barkod ve fiyat her zaman aynı yerdedir. Kullanılmış varyant silinmez, arşivlenir.

## 4. Stok kavramları

| Terim | Anlamı |
|---|---|
| **Остаток** | Depodaki fiziksel miktar (işlenmiş belgelerin toplamı) |
| **Резерв** | İşlenmiş, kapanmamış müşteri siparişlerinde ayrılan miktar (o siparişe bağlı sevkiyatlar düşülür) |
| **Ожидание** | İşlenmiş tedarikçi siparişlerinde beklenen miktar (bağlı mal kabuller düşülür) |
| **Доступно** | Остаток − Резерв: satılabilir miktar; sitelere ve pazaryerlerine bu gönderilir |

## 5. Maliyet (себестоимость)

МойСклад kârlılık raporunda **FIFO** kullanır: satılan malın maliyeti, depodaki en eski alış partisinin fiyatıdır. Vordi de FIFO kullanır (`packages/domain/src/fifo.ts`):

- Mal kabul ve stok girişi fiyatı maliyet katmanı oluşturur.
- Müşteri iadesi ve sayım fazlası, son bilinen maliyetle katmana döner.
- Stok eksiye düşerse maliyet "tahmini" olarak işaretlenir (rapor bunu gösterir).
- Depolar arası transfer maliyeti değiştirmez.

## 6. Cari hesap işaretleri (взаиморасчёты)

| Belge | Cari bakiyeye etkisi |
|---|---|
| Отгрузка, Возврат поставщику, Исходящий платёж, Расходный ордер | + (cari bize borçlanır) |
| Приёмка, Возврат покупателя, Входящий платёж, Приходный ордер | − (biz cariye borçlanırız / cari borcu kapanır) |

## 7. Sayım (Инвентаризация)

Sayım belgesi stoğu doğrudan değiştirmez. Kaydedilirken her satıra o anki **beklenen miktar** yazılır. Uygulanınca fazlalar için **Оприходование**, eksikler için **Списание** belgesi otomatik oluşturulur ve sayıma bağlanır. Vordi'de aynen böyle (`POST /documents/:id/apply-inventory`).

## 8. Yetki modeli

МойСклад'da her çalışanın rolü ve bölüm/işlem bazında hakları vardır; çalışan belirli depolar ve satış noktalarıyla sınırlandırılabilir. Vordi'de şu an dört rol var:

| Rol | Görebildiği / yapabildiği |
|---|---|
| **admin** | Her şey, çalışan yönetimi |
| **manager** | Her şey (çalışan yönetimi hariç) |
| **storekeeper** (depocu) | Ürün sorgulama, depo belgeleri (giriş, çıkış, transfer, sayım, sevkiyat, mal kabul), yalnızca atandığı depolar; maliyet göremez |
| **cashier** (kasiyer) | Perakende satış ve iade, yalnızca atandığı mağaza |

Ayrıntılı hak tablosu (МойСклад'daki gibi bölüm × işlem: görme, oluşturma, düzenleme, silme, işleme) sonraki aşamada eklenecek.

## 9. Sizin istediğiniz ek modüller — plan

| Modül | МойСклад'daki karşılığı | Vordi planı |
|---|---|---|
| **Etiket ve fiyat etiketi tasarlama/basma** | Ценники и этикетки (şablon düzenleyici) | Sürükle-bırak şablon editörü (ad, fiyat, barkod EAN-13/Code128, DataMatrix, QR, artikul); termal etiket yazıcılar için (Xprinter, ATOL BP21, Zebra) PDF ve ZPL/TSPL çıktısı; ürün listesinden veya mal kabul belgesinden toplu basım. Честный знак kodlarının etikete basılması |
| **Gelir-gider tablosu** | Движение денежных средств (ДДС), Прибыли и убытки (ПиУ) | Gider kalemleri (kira, maaş, vergi, kargo…), ödemelerde kalem seçimi; ДДС raporu (kasa/banka akışı, kalem bazında) ve ПиУ raporu (satış geliri − FIFO maliyet − giderler) |
| **Raporlar** | Отчёты | Обороты (dönemsel hareket), satış analizleri (kanal, cari, ürün, çalışan bazında), göstergeler paneli, Excel'e aktarma |
| **Çalışan listesi** | Сотрудники | ✅ temel kayıt hazır; ⏳ ayrıntılı haklar, işlem geçmişi ekranı |
| **Mesai / vardiya ayarlama** | Смены (kasa vardiyası) + görevler | Kasa vardiyası (açma/kapama, X/Z raporu) + çalışan çalışma programı (vardiya planı, giriş-çıkış saati, toplam çalışma süresi, satış primi hesabı için temel) |
| **Честный знак** | Маркировка | ✅ kod ayrıştırma ve belge kontrolü; ⏳ True API ile kod durumu sorgusu, kod siparişi (СУЗ), ввод в оборот, ЭДО ile УПД'den kod kabulü, perakende için ЛМ ЧЗ |

## 10. МойСклад'dan veri aktarımı (planlanan)

МойСклад JSON API 1.2 (`https://api.moysklad.ru/api/remap/1.2`) üzerinden salt-okunur bir aktarıcı yazılacak:

1. Referanslar: склады, группы товаров, типы цен, юрлица, контрагенты, сотрудники (yalnızca ad/rol).
2. Ürünler: товары, модификации (характеристики), штрихкоды, цены, доп. поля, маркировка.
3. Açılış stoku: aktarım tarihindeki остатки ve себестоимость → Vordi'de tek bir "açılış" Оприходование belgesi.
4. Açılış bakiyeleri: контрагент bakiyeleri → açılış belgeleri.
5. İsteğe bağlı: geçmiş belgeler (raporların geçmişi görmesi için).
6. Geçiş döneminde aktarıcı belirli aralıklarla çalışır ve iki sistemin stoklarını karşılaştıran bir fark raporu üretir.
