# Vordi API для интернет-магазина

Базовый адрес: `https://<ваш-сервер>/api/v1`. Все запросы — JSON, кодировка UTF-8.

## Авторизация

Ключ создаёт администратор: **Настройки → Касса и интеграции → API-ключи**. Ключ показывается один раз.

```
Authorization: Bearer vrd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Без ключа или с неверным ключом сервер отвечает `401`.

## Товары

`GET /api/v1/products[?warehouse_id=1]`

```json
[
  { "id": 1, "name": "Кофе молотый 250 г", "code": "KF-250", "article": "KF-250", "barcode": "4600000000017",
    "unit": "шт", "price": 549, "vat": 22, "is_service": false, "group_name": "Напитки",
    "stock": 42, "available": 40 }
]
```

`stock` — физический остаток, `available` — остаток минус резерв открытых заказов. Для услуг `stock` = `null`.

## Остатки

`GET /api/v1/stock[?warehouse_id=1]` — короткий список для частой синхронизации:

```json
[{ "id": 1, "code": "KF-250", "article": "KF-250", "barcode": "4600000000017", "stock": 42, "reserve": 2, "available": 40 }]
```

`GET /api/v1/warehouses` — список складов.

## Заказы

`POST /api/v1/orders`

```json
{
  "external_id": "WEB-1001",
  "customer": { "name": "Петров Пётр", "phone": "+7 916 111-22-33", "email": "petrov@example.ru", "address": "Москва, ..." },
  "items": [
    { "code": "KF-250", "qty": 2 },
    { "barcode": "4600000000031", "qty": 6, "price": 75 }
  ],
  "comment": "Доставка курьером"
}
```

- Товар ищется по `product_id`, `code`, `article` или `barcode`. Если `price` не указан, берётся цена продажи.
- Покупатель ищется по e-mail, затем по телефону (без учёта форматирования); если не найден — создаётся.
- Заказ создаётся как «Заказ покупателя» в статусе «Новый» на складе, выбранном в настройках, и сразу резервирует товар.
- Запрос идемпотентен: повторная отправка с тем же `external_id` вернёт существующий заказ (`"created": false`).

Ответ:

```json
{ "created": true, "order": { "id": 57, "external_id": "WEB-1001", "number": "00013", "status": "new", "sum": 1548, "shipped": false } }
```

`GET /api/v1/orders/{external_id}` — текущий статус заказа.

`POST /api/v1/orders/{external_id}/cancel` — отмена (неотгруженного) заказа.

Статусы: `new`, `confirmed`, `picking`, `shipped`, `delivered`, `cancelled`.

## Пример (curl)

```bash
curl -H "Authorization: Bearer $VORDI_KEY" https://vordi.example.ru/api/v1/stock

curl -X POST -H "Authorization: Bearer $VORDI_KEY" -H "Content-Type: application/json" \
  -d '{"external_id":"WEB-1001","customer":{"name":"Петров Пётр","phone":"+79161112233"},"items":[{"code":"KF-250","qty":2}]}' \
  https://vordi.example.ru/api/v1/orders
```

## Ошибки

`400` — ошибка в данных, `401` — неверный ключ, `404` — не найдено. Тело ответа: `{ "error": "текст" }`.
