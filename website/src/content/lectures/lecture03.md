---
title: "函数与模块化"
lectureNumber: 3
draft: false
---


## 学习目标

- 掌握多种函数定义方式
- 理解作用域和闭包概念
- 学会使用模块化组织代码

---

## 一、函数基础

### 1.1 函数声明

```javascript
// 函数声明
function greet(name) {
  return `Hello, ${name}!`;
}

// 函数表达式
const add = function(a, b) {
  return a + b;
};

// 箭头函数
const multiply = (a, b) => a * b;
```

### 1.2 默认参数

```javascript
function greet(name = 'Guest') {
  return `Welcome, ${name}!`;
}

greet();        // "Welcome, Guest!"
greet('Alice'); // "Welcome, Alice!"
```

---

## 二、作用域与闭包

### 2.1 作用域链

```javascript
const globalVar = '我是全局变量';

function outer() {
  const outerVar = '我是外部变量';
  
  function inner() {
    const innerVar = '我是内部变量';
    console.log(globalVar); // 可以访问
    console.log(outerVar);  // 可以访问
  }
  
  inner();
}
```

### 2.2 闭包示例

```javascript
function createCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    decrement: () => --count,
    getCount: () => count
  };
}

const counter = createCounter();
counter.increment(); // 1
counter.increment(); // 2
```

---

## 三、模块化

### 3.1 导出模块

```javascript
// math.js
export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export default class Calculator {
  // ...
}
```

### 3.2 导入模块

```javascript
// main.js
import Calculator, { PI, add } from './math.js';

console.log(PI);        // 3.14159
console.log(add(2, 3)); // 5
```

---

## 小结

- 灵活使用三种函数定义方式
- 理解作用域链和闭包的原理
- 使用 ES Module 组织代码结构
