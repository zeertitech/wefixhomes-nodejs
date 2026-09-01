# Fashion E-Commerce API Documentation

This document provides a comprehensive list of all available API endpoints, their methods, sample request payloads, and expected response formats.

**Base URL:** `{{baseUrl}}/api/v1` (Default local: `http://localhost:3000/api/v1`)

---

## Table of Contents
1. [Authentication](#1-authentication)
2. [Products](#2-products)
3. [Categories](#3-categories)
4. [Cart](#4-cart)
5. [Orders](#5-orders)
6. [Users & Customers](#6-users--customers)
7. [Payments](#7-payments)
8. [Shipments](#8-shipments)
9. [Inventory](#9-inventory)
10. [System](#10-system)

---

## 1. Authentication
*Base Path: `/auth`*

### 1.1 Staff/Admin Registration
`POST /register`

**Payload:**
```json
{
  "email": "admin@fashionstore.com",
  "password": "Admin@123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "user_uuid",
    "email": "admin@fashionstore.com",
    "role": "ADMIN"
  }
}
```

### 1.2 Login
`POST /login`

**Payload:**
```json
{
  "email": "admin@fashionstore.com",
  "password": "Admin@123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_uuid",
      "email": "admin@fashionstore.com",
      "role": "ADMIN"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### 1.3 Refresh Token
`POST /refresh`

**Payload:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

### 1.4 Get Current User Info
`GET /me`
*Auth: Bearer Token required*

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user_uuid",
    "email": "admin@fashionstore.com",
    "role": "ADMIN",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## 2. Products
*Base Path: `/products`*

### 2.1 List Products
`GET /`
*Query Params: `page`, `limit`, `category`, `search`, `minPrice`, `maxPrice`*

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_uuid",
      "name": "Luxury Silk Saree",
      "slug": "luxury-silk-saree",
      "basePrice": 4999.00,
      "images": ["url1", "url2"],
      "category": { "name": "Sarees" }
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

### 2.2 Get Product by Slug
`GET /:slug`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "prod_uuid",
    "name": "Luxury Silk Saree",
    "description": "Premium silk saree with gold zari",
    "variants": [
      {
        "id": "var_uuid",
        "sku": "SAREE-RED-01",
        "price": 4999.00,
        "stock": 10,
        "attributes": { "color": "Red", "size": "Standard" }
      }
    ]
  }
}
```

### 2.3 Create Product
`POST /`
*Auth: ADMIN required*

**Payload:**
```json
{
  "name": "New Collection Dress",
  "description": "Latest summer collection",
  "categoryId": "cat_uuid",
  "basePrice": 2999,
  "variants": [
    {
      "sku": "DR-SUM-01",
      "price": 2999,
      "attributes": { "size": "M", "color": "Blue" }
    }
  ]
}
```

---

## 3. Categories
*Base Path: `/categories`*

### 3.1 List Categories (Nested)
`GET /`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_uuid",
      "name": "Ethnic Wear",
      "children": [
        { "id": "child_uuid", "name": "Sarees" }
      ]
    }
  ]
}
```

---

## 4. Cart
*Base Path: `/cart`*

### 4.1 Get or Create Cart
`GET /`
*Query Params: `userId` (for logged-in) or `sessionId` (for guests)*

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cart_uuid",
    "items": [],
    "totalPrice": 0
  }
}
```

### 4.2 Add Item to Cart
`POST /:cartId/items`

**Payload:**
```json
{
  "variantId": "var_uuid",
  "quantity": 1
}
```

---

## 5. Orders
*Base Path: `/orders`*

### 5.1 Create Order
`POST /`

**Payload:**
```json
{
  "customerId": "cust_uuid",
  "addressId": "addr_uuid",
  "cartId": "cart_uuid",
  "notes": "Please deliver after 6 PM"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "order_uuid",
    "orderNumber": "ORD-123456",
    "totalAmount": 4999.00,
    "status": "PENDING_PAYMENT"
  }
}
```

---

## 6. Users & Customers
*Base Path: `/api/v1/customers` (Note: Currently defined but not registered in setup.ts)*

### 6.1 Create Customer
`POST /`

**Payload:**
```json
{
  "email": "customer@example.com",
  "firstName": "Sathya",
  "lastName": "Prakash",
  "phone": "9876543210"
}
```

### 6.2 Add Address
`POST /:id/addresses`

**Payload:**
```json
{
  "type": "HOME",
  "street": "123 Main St",
  "city": "Chennai",
  "state": "Tamil Nadu",
  "zip": "600001",
  "country": "India",
  "isDefault": true
}
```

---

## 7. Payments
*Base Path: `/payments`*

### 7.1 Create Razorpay Order
`POST /orders/:orderId`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_K8d...",
    "amount": 499900,
    "currency": "INR",
    "key": "rzp_test_..."
  }
}
```

---

## 8. Shipments
*Base Path: `/shipments`*

### 8.1 Track Shipment
`GET /orders/:orderId/track`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "IN_TRANSIT",
    "awb": "123456789",
    "trackingData": []
  }
}
```

---

## 9. Inventory
*Base Path: `/inventory`*

### 9.1 Update Stock
`PATCH /variants/:variantId`
*Auth: ADMIN/STAFF required*

**Payload:**
```json
{
  "quantity": 50,
  "lowStockAt": 5
}
```

---

## 10. System
*Base Path: `/`*

### 10.1 Health Check
`GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-05-16T...",
  "uptime": 123.45
}
```
