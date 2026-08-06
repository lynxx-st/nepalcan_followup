NCM API DOCUMENTATION

# NCM API COLLECTION

# What is NCM API?

NCM API service gives you the capability to integrate your online system with NCM's portal. Our API service currently provides you the capability to

- \[ ✔ \] Fetch Particular Order Details
- \[ ✔ \] Fetch Order Comments
- \[ ✔ \] Fetch last 25 comments of orders
- \[ ✔ \] Fetch Order Status
- \[ ✔ \] Create a new Order right from your own system

## API Limits

Order Creation : 1,000 per day

Order View (Detail, Comments, Status ): 20,000 per day

## Every vendor is provided with an API Token Key. Use this api token key to make an api request into the server

If you forgot the token or want to request new token, contact our IT Admin.

## GET Branch Lists with details

This endpoint allows to fetch the list of all branches of NCM with their details like phone number, covered areas, district, regions etc.

Link: <https://demo.nepalcanmove.com/api/v2/branches>

## GET Delivery Charges between branches

This endpoint allows to calculate the delivery charge for the branches.

Link: [https://demo.nepalcanmove.com/api/v1/shipping-rate? creation=TINKUNE&destination=POKHARA&type=Pickup/Collect](https://demo.nepalcanmove.com/api/v1/shipping-rate?creation=TINKUNE&destination=POKHARA&type=Pickup/Collect) Params:

creation : pickup branch

destination : destination branch to where order needs to be send type : delivery type

Available Delivery Types for 'type' parameter:

| **Type Value** | **Description**                                                    | **Charge**<br><br>**Calculation** |
| -------------- | ------------------------------------------------------------------ | --------------------------------- |
| Pickup/Collect | Door2Door (NCM pickup & delivery)                                  | Full base charge                  |
| Send           | Branch2Door (Sender drops at branch, NCM delivers at door)         | Full base charge                  |
| D2B            | Door2Branch (NCM pick, Customer collect at branch)                 | Base charge - 50                  |
| B2B            | Branch2Branch (Sender Drop at branch & customer collect at branch) | Base charge - 50                  |

Headers

Authorization Token &lt;your token keys&gt;

## GET Order Details

This endpoint allows to fetch the details of a particular order in your system. These details are the same as the details you see on the NCM portal when you view a particular order.

Link: <https://demo.nepalcanmove.com/api/v1/order?id=ORDERID>

Headers

Authorization Token &lt;your token keys&gt;

## Params

id ORDERID your order id in ncm system

## Example

curl --location --request GET <https://demo.nepalcanmove.com/api/v1/order?id=134> \\

\--header "Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45" \\

## Result

Response Status 200

{

"orderid": 134,

"cod_charge": "1710.00",

"delivery_charge": "99.00",

"last_delivery_status": "Delivered", "payment_status": "Completed"

}

## GET Order Comments

This endpoint allows to fetch the comments of a particular order in your system. The api will provide all the comments done in a particular order. Comments will be in descending order of created date.

Link: <https://demo.nepalcanmove.com/api/v1/order/comment?id=ORDERID>

Headers

Authorization Token &lt;your access token keys&gt;

## Params

id ORDERID your order id in ncm system

## Example

curl --location --request GET [https://demo.nepalcanmove.com/api/v1/order/comment? id=134](https://demo.nepalcanmove.com/api/v1/order/comment?id=134) \\

\--header "Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45" \\

## Result

Response Status 200 \[

{

"orderid": 134,

"comments": "Please provide us with the correct phone number?", "addedBy": "NCM Staff",

"added_time": "2019-11-02T16:43:15.687200+05:45"

},

{

"orderid": 134,

"comments": "Test comments", "addedBy": "Vendor",

"added_time": "2019-10-15T12:22:15.989560+05:45"

},

{

"orderid": 134,

"comments": "Test Comment", "addedBy": "NCM Staff",

"added_time": "2019-10-15T11:33:16.472031+05:45"

}

\]

## GET LAST 25 Order Comments

This endpoint allows to fetch the last 25 comments done to your orders. Latest comments will be fetched at the top.

Link: <https://demo.nepalcanmove.com/api/v1/order/getbulkcomments>

Headers

Authorization Token &lt;your access token keys&gt;

## Example

curl --location --request GET

<https://demo.nepalcanmove.com/api/v1/order/getbulkcomments> \\

\--header "Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45"

## Result

Response Status 200 \[

{

"orderid": 123,

"comments": "Test Comments", "addedBy": "NCM Staff",

"added_time": "2020-01-28T18:20:29.349013+05:45"

},

{

"orderid": 123,

"comments": "Phone Not Received Multiple Times", "addedBy": "NCM Staff",

"added_time": "2020-01-29T11:04:51.510397+05:45"

},

{

"orderid": 123,

"comments": "Phone Not Received Multiple Times", "addedBy": "NCM Staff",

"added_time": "2020-01-28T16:02:54.335899+05:45"

},

{

"orderid": 123,

"comments": "Area not covered by NCM", "addedBy": "NCM Staff",

"added_time": "2020-01-28T15:59:55.371198+05:45"

}

...

\]

## GET Order Status

This endpoint allows to fetch the status of a particular order in your system. The api will provide all the status of a particular order. Statuses will be in descending order of created date.

Link: <https://demo.nepalcanmove.com/api/v1/order/status?id=ORDERID>

Headers

Authorization Token &lt;your access token keys&gt;

## Params

id ORDERID your order id in ncm system

## Example

curl --location --request GET [https://demo.nepalcanmove.com/api/v1/order/status? id=134](https://demo.nepalcanmove.com/api/v1/order/status?id=134) \\

\--header "Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45"

## Result

Response Status 200 \[

{

"orderid": 134,

"status": "Delivered",

"added_time": "2019-10-18T13:24:30.960365+05:45"

},

{

"orderid": 134,

"status": "Sent for Delivery",

"added_time": "2019-10-18T13:22:21.033595+05:45"

},

{

"orderid": 134,

"status": "Pickup Complete",

"added_time": "2019-10-18T13:17:25.326792+05:45"

},

{

"orderid": 134,

"status": "Sent for Pickup",

"added_time": "2019-10-18T13:15:24.313074+05:45"

},

{

"orderid": 134,

"status": "Pickup Order Created",

"added_time": "2019-10-15T11:32:18.149352+05:45"

}

\]

## Possible Errors in GET requests

\*If token is not provided Response Status 401:

{

"detail": "Authentication credentials were not provided."

}

\*If Order ID is missing/empty Response Status 400:

{

"detail": "ID parameter missing"

}

\*If invalid or unknown order id provided Response Status 404:

{

"detail": "Not found."

}

Response Status 500:

{

"detail": "Server Error"

}

# POST Create an order

This endpoint allows you to create an order from your system. Vendor must provide necessary details from their end to create an order through this endpoint.

Link: <https://demo.nepalcanmove.com/api/v1/order/create>

Headers

Authorization Token &lt;your access token keys&gt;

## Params

| **Params**  | **Requirement** | **Description**               |
| ----------- | --------------- | ----------------------------- |
| name        | required        | customer name                 |
| phone       | required        | customer phone number         |
| phone2      | optional        | customer secondary phone      |
| cod_charge  | required        | cod amount including delivery |
| address     | required        | general address of customer   |
| fbranch     | required        | From branch name              |
| branch      | required        | Destination branch name       |
| package     | optional        | Package name or type          |
| vref_id     | optional        | Vendor reference id           |
| instruction | optional        | Delivery Instruction          |

Params Requirement Description

| delivery_type | optional | Delivery Type: Door2Door, Branch2Door, Branch2Branch, Door2Branch<br><br>(default: Door2Door if not provided) |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| weight        | optional | Weight in kg (default: 1 kg if not provided)                                                                  |

## Example

curl --location --request POST '[https://demo.nepalcanmove.com/api/v1/order/create'](https://demo.nepalcanmove.com/api/v1/order/create%27)

\\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45' \\

\--header 'Content-Type: application/json' \\

\--data-raw '{

"name":"John Doe",

"phone":"9847023226",

"phone2":"",

"cod_charge":"2200",

"address":"Byas Pokhari", "fbranch":"TINKUNE",

"branch":"BIRATNAGAR",

"package": "Jeans Pant", "vref_id" : "VREF234",

"instruction" : "Test Instruction", "delivery_type" : "Branch2Door",

"weight" : "2"

}'

## Result

Status 200

{

"Message": "Order Successfully Created", "orderid": 747

}

## Error if fields are missing

Status 400

{

"Error": {

"cod_charge": "Invalid COD Amount", "phone": "Invalid Phone Number",

"branch": "Invalid Branch", "name": "Invalid Name",

"address": "Invalid Address"

}

}

# POST Create an order comment

This endpoint allows you to create a comment from your system. Vendor must provide necessary details from their end to create a comment through this endpoint.

Link: <https://demo.nepalcanmove.com/api/v1/comment>

Headers

Authorization Token &lt;your access token keys&gt;

## Params

| **Params** | **Requirement** | **Description**              |
| ---------- | --------------- | ---------------------------- |
| orderid    | required        | order id in ncm portal       |
| comments   | required        | text comment to put in order |

## Example

curl --location --request POST '[https://demo.nepalcanmove.com/api/v1/comment'](https://demo.nepalcanmove.com/api/v1/comment%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45' \\

\--header 'Content-Type: application/json' \\

\--data-raw '{

"orderid":"1234567",

"comments" : "Test comment from api"

}'

## Result

Status 200

{

"message": "Comment successfully created"

}

## Error if fields are missing

Status 400

{

"Error": {

"Order Id": "Invalid / Empty orderid", "Comments": "Invalid / Empty comment",

}

}

# POST Retrieve Order statuses

This endpoint allows you to get status for the order ids provided through this endpoint.

Link: <https://demo.nepalcanmove.com/api/v1/orders/statuses>

Headers

Authorization Token &lt;your access token keys&gt;

## Params

| **Params** | **Requirement** | **Description**        |
| ---------- | --------------- | ---------------------- |
| orders     | required        | order id in ncm portal |

## Example

curl --location --request POST

'[https://demo.nepalcanmove.com/api/v1/orders/statuses'](https://demo.nepalcanmove.com/api/v1/orders/statuses%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45' \\

\--header 'Content-Type: application/json' \\

\--data-raw '{ "orders": \[4041,3855,4032,3841,3842,4042\] }'

## Result

Status 200

{

"result": {

"4041": "Pickup Order Created", "3855": "Arrived",

"4032": "Drop off Order Created",

"3841": "Delivered",

"3842": "Delivered"

},

"errors": \[ 4042

\]

}

## POST Create Generic Vendor Ticket

This endpoint allows vendors to create a general support ticket.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/ticket/create/new> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params**  | **Requirement** | **Description**                            |
| ----------- | --------------- | ------------------------------------------ |
| ticket_type | required        | Type of ticket (see available types below) |
| message     | required        | Message/description (max 500 chars)        |
| branch      | conditional     | Required only when ticket_type is Pickup   |

Available Ticket Types:

- General - General inquiries or issues
- Order Processing - Order processing related issues
- Return - Return/refund related requests
- Pickup - Pickup scheduling or issues

## Example

{

"ticket_type": "Pickup",

"message": "98XXXXXXXX, No. of Packets: 5, Address: Baneshwor", "branch": "Tinkune"

}

## Result

Status 201

{

"message": "Ticket created", "ticket": 123

}

Note:

- branch is mandatory for Pickup ticket creation.
- branch must be one of the vendor's assigned pickup branches.

## POST Create COD Transfer Ticket

This endpoint allows vendors to create a COD transfer request ticket.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/ticket/cod/create> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params**        | **Requirement** | **Description**     |
| ----------------- | --------------- | ------------------- |
| bankName          | required        | Name of the bank    |
| bankAccountName   | required        | Account holder name |
| bankAccountNumber | required        | Bank account number |

## Example

{

"bankName": "Nepal Bank Limited", "bankAccountName": "John Doe",

"bankAccountNumber": "1234567890"

}

## Result

Status 201

{

"message": "COD ticket created",

"ticket": 124

}

## POST Close Vendor Ticket

This endpoint allows vendors to close their own tickets.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/ticket/close/&lt;ticket_id>&gt; Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params** | **Requirement** | **Description**         |
| ---------- | --------------- | ----------------------- |
| pk         | required        | Ticket ID (in URL path) |

## Example

curl --location --request POST

'[https://demo.nepalcanmove.com/api/v2/vendor/ticket/close/123'](https://demo.nepalcanmove.com/api/v2/vendor/ticket/close/123%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45' \\

\--header 'Content-Type: application/json'

## Result

Status 200

{

"message": "Ticket closed", "ticket": 123

}

## GET Staff List

This endpoint retrieves a paginated list of active staff members.

Link: [https://demo.nepalcanmove.com/api/v2/vendor/staffs? q=search_term&page=1&page_size=20](https://demo.nepalcanmove.com/api/v2/vendor/staffs?q=search_term&page=1&page_size=20)

Method: GET

Authorization: Token &lt;your_token&gt;

## Query Params

| **Params** | **Requirement** | **Description**                              |
| ---------- | --------------- | -------------------------------------------- |
| q          | optional        | Search staff by name (contains)              |
| page       | optional        | Page number (default: 1)                     |
| page_size  | optional        | Results per page (default: 20, alias: limit) |
| limit      | optional        | Alias for page_size                          |

## Example

curl --location --request GET '[https://demo.nepalcanmove.com/api/v2/vendor/staffs? q=ram&page=1&limit=10'](https://demo.nepalcanmove.com/api/v2/vendor/staffs?q=ram&page=1&limit=10%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45'

## Result

Status 200

{

"count": 45,

"next": "<https://demo.nepalcanmove.com/api/v2/vendor/staffs?page=2>", "previous": null,

"results": \[

{

"id": 12,

"name": "Ram Sharma",

"email": "[ram@example.com](mailto:ram@example.com)", "phone": "9841234567"

}

\]

}

## GET Vendor Assigned Branches

This endpoint returns all pickup branches assigned to the authenticated vendor.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/assigned-branches> Method: GET

Authorization: Token &lt;your_token&gt;

## Query Params

No query params are required.

## Example

curl --location --request GET

'[https://demo.nepalcanmove.com/api/v2/vendor/assigned-branches'](https://demo.nepalcanmove.com/api/v2/vendor/assigned-branches%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45'

## Result

Status 200 \[

"KATHMANDU", "POKHARA", "BIRATNAGAR"

\]

Note:

Response is a simple array of branch names.

If no branches are assigned, the API returns an empty array \[\].

## POST Return Order

This endpoint allows vendors to mark an order for return process.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/order/return> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params** | **Requirement** | **Description** |
| ---------- | --------------- | --------------- |
| pk         | required        | Order ID        |

Params Requirement Description

| comment | optional | Comment/reason for the return |
| ------- | -------- | ----------------------------- |

## Example

curl --location --request POST

'[https://demo.nepalcanmove.com/api/v2/vendor/order/return'](https://demo.nepalcanmove.com/api/v2/vendor/order/return%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45' \\

\--header 'Content-Type: application/json' \\

\--data-raw '{

"pk": 4041,

"comment": "Customer refused the delivery"

}'

## Result

Status 200

{

"message": "Order marked for return successfully", "order": 4041,

"vendor_return": true

}

## Error Responses

Status 400

{

"message": "Order ID is required"

}

Status 404

{

"message": "Order not found"

}

Note:

This sets the order's vendor_return flag to true

If a comment is provided, it creates an external comment with "Pending" status Only the vendor who owns the order can mark it for return

## POST Create Exchange Order

This endpoint creates exchange orders for returning items and sending replacements.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/order/exchange-create> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params** | **Requirement** | **Description**   |
| ---------- | --------------- | ----------------- |
| pk         | required        | Original order ID |

## Example

{

"pk": 4041

}

## Result

Status 200

{

"message": "Exchange orders created", "cust_order": 4567,

"ven_order": 4568

}

**Note:** This creates two orders:

- Customer order (cust_order): New delivery to customer
- Vendor order (ven_order): Return of old item to vendor

## POST Redirect Order

This endpoint allows vendors to redirect an order to a different address/customer.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/order/redirect> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params**    | **Requirement** | **Description**                         |
| ------------- | --------------- | --------------------------------------- |
| pk            | required        | Order ID                                |
| name          | required        | New customer name                       |
| phone         | required        | New customer phone                      |
| address       | required        | New customer address                    |
| vendorOrderid | optional        | Vendor's reference order ID             |
| destination   | optional        | New destination branch ID (if changing) |
| cod_charge    | optional        | New COD amount (decimal value)          |

## Example

{

"pk": 4041,

"name": "New Customer Name", "phone": "9841234567",

"address": "New delivery address, Kathmandu", "vendorOrderid": "VORD-12345",

"destination": 5,

"cod_charge": 750.5

}

## Result

Status 200

{

"message": "Order redirected successfully", "order": 4041,

"cod_charge": "500.00",

"delivery_charge": "175.00",

"changelogs": "-destination_branch was changed from TINKUNE to POKHARA\\n-delivery_charge was changed from 150 to 175\\nBranch Changed.\\n"

}

Note:

If destination branch is changed, RDRT-DiFF-BRNCH charge is added If destination remains same, REDIRECT charge is added

Creates new customer record if phone doesn't exist

COD charge can be updated by providing cod_charge parameter (optional) All changes are logged in order changelogs

## POST Create/Update Webhook URLs

This endpoint allows vendors to create, update or remove their webhook URLs used by NCM to push order status and comment events.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/webhook> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params**  | **Requirement** | **Description**                                       |
| ----------- | --------------- | ----------------------------------------------------- |
| webhook_url | required        | Order status webhook URL (must start with http/https) |

Notes:

- If webhook_url is an empty string, the stored order status webhook URL will be removed.
- URLs when provided, must start with http:// or https://.

## Example: Set webhooks

{

"webhook_url": "<https://example.com/webhooks/order-status>"

}

## Example: Remove order status webhook

{

"webhook_url": ""

}

## Result

Status 200

{

"success": true,

"message": "Webhook URLs updated successfully!"

}

or, on first-time creation:

Status 201

{

"success": true,

"message": "Webhook URLs created successfully!"

}

## Error Responses

Status 400

{

"success": false,

"message": "Please enter a valid URL for Order Status Webhook (must start with http:// or https://)"

}

## POST Test Webhook URL

This endpoint sends a test payload to a given webhook URL so vendors can verify that their endpoint is reachable and correctly processes status updates.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/webhook/test> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Params

| **Params**  | **Requirement** | **Description**                        |
| ----------- | --------------- | -------------------------------------- |
| webhook_url | required        | Your webhook endpoint URL (http/https) |

## Test Payload

The API will send a JSON body similar to:

{

"event": "order.status.changed", "order_id": "TEST-123456",

"status": "In Transit",

"timestamp": "2024-01-01T12:00:00+05:45",

"test": true

}

## Example

{

"webhook_url": "<https://example.com/webhooks/order-status>"

}

## Result (success)

Status 200

{

"success": true,

"status_code": 200, "response": "OK"

}

## Result (HTTP error from your server)

Status 200

{

"success": true,

"status_code": 400,

"response": "Bad Request", "headers": {

"Content-Type": "text/plain"

}

}

## Result (connection/timeout error)

Status 200

{

"success": false,

"error": "Request timed out. The webhook URL did not respond within 10 seconds."

}

Status 200

{

"success": false,

"error": "Connection error. Could not connect to the webhook URL. Details: ..."

}

## GET Ticket Detail API

Link: <https://demo.nepalcanmove.com/api/v1/tickets/&lt;ticket_id&gt;/detail> Method: GET

Authorization: Token &lt;your_token&gt;

Access Rules

- Vendor can view only own ticket.
- Logistics can view only assigned ticket.
- Other roles are forbidden.

Example

curl --location --request GET

'[https://demo.nepalcanmove.com/api/v1/tickets/2639/detail'](https://demo.nepalcanmove.com/api/v1/tickets/2639/detail%27) \\

\--header 'Authorization: Token &lt;your_token&gt;'

Sample Response

Status 200

{

"success": true, "ticket": {

"id": 2639,

"ticket_type": "Pickup",

"message": "dfsdf&lt;br&gt;No. of Packets: 33&lt;br&gt;Address: Pariatur Corporis e &lt;br&gt; Actual Pickup count : 52",

"added_on": "2026-04-09T11:28:00+05:45",

"status": false, "comment": "",

"attachment": null, "branch": "BUTWAL", "closed_on": null, "vendor": {

"id": 629,

"name": "Vendor NCM",

"location": "27.700769,85.300140"

},

"assigned_to": { "id": 43,

"name": "Ram Logistics"

},

"closed_by": {

"id": null, "name": null

}

},

"responses": \[

{

"id": 901,

"message": "Please pickup tomorrow morning.", "added_on": "2026-04-09T12:10:00+05:45",

"vendor_display": true, "added_by": {

"id": 629,

"name": "Vendor NCM"

}

}

\]

}

## POST Vendor Ticket Response Create API

Endpoint

Link: <https://demo.nepalcanmove.com/api/v1/vendor/tickets/&lt;ticket_id&gt;/response> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

Request Body

{

"message": "Response text from vendor"

}

Behavior

- Creates a ticket response with vendorDisplay=true.
- If ticket is closed, it is reopened automatically.

Example

curl --location --request POST

'[https://demo.nepalcanmove.com/api/v1/vendor/tickets/2639/response'](https://demo.nepalcanmove.com/api/v1/vendor/tickets/2639/response%27) \\

\--header 'Authorization: Token &lt;your_token&gt;' \\

\--header 'Content-Type: application/json' \\

\--data-raw '{

"message": "Please check this update from vendor side."

}'

Sample Response

Status 201

{

"success": true, "ticket_id": 2639, "response": {

"id": 902,

"message": "Please check this update from vendor side.", "added_on": "2026-04-09T12:35:10+05:45",

"vendor_display": true, "added_by": {

"id": 629,

"name": "Vendor NCM"

}

}

}

## GET Vendor Customer List

Returns a paginated list of customers associated with your vendor account - either created by you or who have received at least one of your orders.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/customers> Method: GET

Authorization: Token &lt;your_token&gt;

## Query Params

| **Params** | **Requirement** | **Description**                              |
| ---------- | --------------- | -------------------------------------------- |
| page       | optional        | Page number (default: 1)                     |
| page_size  | optional        | Results per page (default: 25, maximum: 100) |
| name       | optional        | Filter customers by name (contains)          |

Params Requirement Description

| phone | optional | Filter customers by phone (starts with) |
| ----- | -------- | --------------------------------------- |

## Example

curl --location --request GET

'[https://demo.nepalcanmove.com/api/v2/vendor/customers?page=1'](https://demo.nepalcanmove.com/api/v2/vendor/customers?page=1%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45'

## Result

Status 200

{

"count": 320,

"next": "<https://demo.nepalcanmove.com/api/v2/vendor/customers?page=2>", "previous": null,

"results": \[

{

"id": 109523,

"name": "John Doe",

"phone": "9841234567",

"address": "Baneshwor, Kathmandu"

},

{

"id": 109524,

"name": "Jane Smith", "phone": "9807654321",

"address": ""

}

\]

}

## GET Vendor Customer Detail

Returns full profile and complete order history for a specific customer of your vendor account.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/customers/&lt;customer_id&gt;/detail> Method: GET

Authorization: Token &lt;your_token&gt;

## URL Params

| **Params**  | **Requirement** | **Description**           |
| ----------- | --------------- | ------------------------- |
| customer_id | required        | Customer ID (in URL path) |

## Example

curl --location --request GET

'[https://demo.nepalcanmove.com/api/v2/vendor/customers/109523/detail'](https://demo.nepalcanmove.com/api/v2/vendor/customers/109523/detail%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45'

## Result

Status 200

{

"id": 109523,

"name": "John Doe",

"phone": "9841234567",

"email": "[john@example.com](mailto:john@example.com)", "orders": \[

{

"orderid": 74821,

"created_date": "2026-04-15T10:30:00+05:45",

"cod_charge": "1500.00",

"delivery_charge": "150.00",

"last_delivery_status": "Delivered"

},

{

"orderid": 74100,

"created_date": "2026-03-10T09:15:00+05:45",

"cod_charge": "2200.00",

"delivery_charge": "150.00",

"last_delivery_status": "Sent to Vendor"

}

\]

}

## Error Responses

Status 404

{

"detail": "Customer not found"

}

Status 404

{

"detail": "Not found"

}

## GET Customer Rating Stats

Returns delivery performance stats for a customer by phone number - total orders placed, successful deliveries, and returns across the entire NCM system.

Link: [https://demo.nepalcanmove.com/api/v2/vendor/ratings?phone=](https://demo.nepalcanmove.com/api/v2/vendor/ratings?phone)&lt;phone&gt; Method: GET

Authorization: Token &lt;your_token&gt;

## Query Params

| **Params** | **Requirement** | **Description**         |
| ---------- | --------------- | ----------------------- |
| phone      | required        | Customer's phone number |

## Example

curl --location --request GET

'[https://demo.nepalcanmove.com/api/v2/vendor/ratings?phone=9841234567'](https://demo.nepalcanmove.com/api/v2/vendor/ratings?phone=9841234567%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45'

## Result

Status 200

{

"phone": "9841234567",

"total_orders": 18,

"total_delivered": 15,

"total_returned": 3

}

## Error Responses

Status 400

{

"detail": "phone parameter is required"

}

Status 404

{

"detail": "No customer found with this phone number"

}

## GET Order Label Data (Single Order)

Returns all information needed to render a delivery label for a specific order. Only the authenticated vendor's own orders are accessible.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/order/label/&lt;order_id>&gt; Method: GET

Authorization: Token &lt;your_token&gt;

## URL Params

| **Params** | **Requirement** | **Description**        |
| ---------- | --------------- | ---------------------- |
| order_id   | required        | Order ID (in URL path) |

## Example

curl --location --request GET

'[https://demo.nepalcanmove.com/api/v2/vendor/order/label/346844'](https://demo.nepalcanmove.com/api/v2/vendor/order/label/346844%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45'

## Result

Status 200

{

"orderid": 346844,

"delivery_type": "Home", "cod_charge": "1500.00", "from_branch": {

"name": "TINKUNE",

"code": "TINK1",

"district": "Kathmandu"

},

"to_branch": {

"name": "BIRATNAGAR", "code": "BIRA1",

"district": "Morang"

},

"from": {

"name": "Vendor Name", "phone": "9841000000",

"phone2": ""

},

"receiver": {

"name": "John Doe",

"phone": "9847000000",

"phone2": "",

"address": "Baneshwor, Kathmandu"

},

"description": {

"description": "Blue jeans",

"delivery_instruction": "Handle carefully", "handling": "Non-Fragile",

"vendor_orderid": "VREF-123"

}

}

## Error Responses

Status 404

{

"detail": "Order not found"

}

## POST Order Label Data (Multiple Orders)

Returns label data for multiple orders in a single request. Pass an array of order IDs in the request body. Only orders belonging to the authenticated vendor are returned.

Link: <https://demo.nepalcanmove.com/api/v2/vendor/order/label/> Method: POST

Authorization: Token &lt;your_token&gt; Content-Type: application/json

## Body Params

| **Params** | **Requirement** | **Description**                                |
| ---------- | --------------- | ---------------------------------------------- |
| ids        | required        | Array of integer order IDs (must be non-empty) |

## Example

curl --location --request POST

'[https://demo.nepalcanmove.com/api/v2/vendor/order/label/'](https://demo.nepalcanmove.com/api/v2/vendor/order/label/%27) \\

\--header 'Authorization: Token a3dede0dcfb45e2af76ced9f7a74909aac9d0a45' \\

\--header 'Content-Type: application/json' \\

\--data-raw '{

"ids": \[346844, 346845, 99999\]

}'

## Result

Status 200

{

"labels": \[

{

"orderid": 346844,

"delivery_type": "Home", "cod_charge": "1500.00", "from_branch": {

"name": "TINKUNE",

"code": "TINK1",

"district": "Kathmandu"

},

"to_branch": {

"name": "BIRATNAGAR", "code": "BIRA1",

"district": "Morang"

},

"from": {

"name": "Vendor Name", "phone": "9841000000",

"phone2": ""

},

"receiver": {

"name": "John Doe",

"phone": "9847000000",

"phone2": "",

"address": "Baneshwor, Kathmandu"

},

"description": {

"description": "Blue jeans",

"delivery_instruction": "Handle carefully", "handling": "Non-Fragile",

"vendor_orderid": "VREF-123"

}

},

{

"orderid": 346845,

"delivery_type": "Office", "cod_charge": "2200.00",

...

}

\],

"not_found": \[99999\]

}

## Response Fields

| **Field** | **Type**          | **Description**                                                                                         |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| labels    | array of objects  | Label data for every ID that was found and belongs to this vendor. Same structure as GET.               |
| not_found | array of integers | IDs from the request that were not found or belong to a different vendor. Empty \[\] if all were found. |

## Error Responses

Status 400

{

"detail": "\\"ids\\" must be a non-empty array"

}

Status 401

{

"detail": "Authentication credentials were not provided."

}

Notes:

- delivery_type returns "Office" for D2B/B2B orders and "Home" for all others.
- from contains vendor details for Vendor-type orders, or sender customer details otherwise.
- description fields are null if no description was added to the order.
- handling will be "Fragile", "Fragile and Valuable", "Valuable", or "Non-Fragile".
- IDs belonging to a different vendor are silently returned in not_found - same as a wrong ID.
- Order of items in labels may not match the order of ids in the request. Match by orderid on the client side if order matters.
- Keep batch sizes reasonable (recommended ≤ 100 IDs per request).

_Please use this api endpoints very carefully._

_Avoid duplication of order creation from both bulk file upload and api system. No Spamming or running scripts to overload the server._

![Logo](data:image/png;base64,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)

Tel: 015199684

Tinkune, Kathmandu

[Nepal Can Move](https://portal.nepalcanmove.com/)