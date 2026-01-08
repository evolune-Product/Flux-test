# Free APIs for Testing - Organized by Test Type

## 1. Functional Testing
**Purpose:** Test basic CRUD operations and response validation
```
GET  https://jsonplaceholder.typicode.com/posts
POST https://jsonplaceholder.typicode.com/posts
PUT  https://jsonplaceholder.typicode.com/posts/1
DELETE https://jsonplaceholder.typicode.com/posts/1
```

## 2. GraphQL Testing
**Purpose:** Test GraphQL queries and mutations
```
POST https://countries.trevorblades.com/
GraphQL Query:
{
  country(code: "US") {
    name
    capital
    currency
  }
}
```

## 3. Contract Testing
**Purpose:** Test API schema and contract validation
```
GET https://reqres.in/api/users/2
Expected Schema: { "data": { "id", "email", "first_name", "last_name" } }
```

## 4. Smoke Testing
**Purpose:** Quick health checks and basic availability
```
GET https://api.ipify.org?format=json
GET https://httpbin.org/status/200
GET https://dog.ceo/api/breeds/image/random
```

## 5. Regression Testing
**Purpose:** Test consistent behavior over time
```
GET https://restcountries.com/v3.1/alpha/IND
GET https://catfact.ninja/fact
GET https://official-joke-api.appspot.com/random_joke
```

## 6. Fuzz Testing
**Purpose:** Test with random/invalid inputs
```
GET https://httpbin.org/status/404
GET https://httpbin.org/status/500
POST https://jsonplaceholder.typicode.com/posts (with invalid JSON)
GET https://reqres.in/api/users/999999 (non-existent user)
```

## 7. Performance/Load Testing
**Purpose:** Test response times and rate limits
```
GET https://httpbin.org/delay/2
GET https://httpbin.org/delay/5
GET https://dummyjson.com/products?limit=100
GET https://api.publicapis.org/entries
```

## 8. Security Testing
**Purpose:** Test headers, HTTPS, authentication
```
GET https://httpbin.org/headers
GET https://httpbin.org/user-agent
GET https://httpbin.org/ip
POST https://httpbin.org/post (test CORS, headers)
```

---

## Additional Test Endpoints

### HTTPBin (Universal Testing)
```
GET  https://httpbin.org/get
POST https://httpbin.org/post
PUT  https://httpbin.org/put
DELETE https://httpbin.org/delete
GET  https://httpbin.org/status/200
GET  https://httpbin.org/delay/3
```

### DummyJSON (Rich Test Data)
```
GET https://dummyjson.com/products
GET https://dummyjson.com/users
GET https://dummyjson.com/carts
```

---

**All APIs require NO authentication!**
