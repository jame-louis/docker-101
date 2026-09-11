# 核心语法与数据类型

## 学习目标

- 掌握变量的声明和使用
- 理解基本数据类型和类型转换
- 熟练使用条件语句和循环语句

---

## 一、变量与常量

### 1.1 变量声明

```javascript
// 使用 let 声明可变变量
let name = 'Alice';
name = 'Bob'; // 可以重新赋值

// 使用 const 声明常量
const PI = 3.14159;
// PI = 3.14; // 错误！常量不能重新赋值
```

### 1.2 命名规范

- 使用驼峰命名法：`studentName`
- 常量使用大写：`MAX_SIZE`
- 避免使用保留字

---

## 二、数据类型

### 2.1 基本类型

| 类型 | 示例 | 说明 |
|------|------|------|
| String | `"hello"` | 文本字符串 |
| Number | `42`, `3.14` | 整数和浮点数 |
| Boolean | `true`, `false` | 布尔值 |
| Undefined | `undefined` | 未定义 |
| Null | `null` | 空值 |

### 2.2 类型检测

```javascript
typeof "hello";   // "string"
typeof 42;        // "number"
typeof true;      // "boolean"
typeof undefined; // "undefined"
```

---

## 三、流程控制

### 3.1 条件语句

```javascript
const score = 85;

if (score >= 90) {
  console.log('优秀');
} else if (score >= 80) {
  console.log('良好');
} else if (score >= 60) {
  console.log('及格');
} else {
  console.log('不及格');
}
```

### 3.2 循环语句

```javascript
// for 循环
for (let i = 0; i < 5; i++) {
  console.log(i);
}

// while 循环
let count = 0;
while (count < 5) {
  console.log(count);
  count++;
}
```

---

## 小结

- 使用 `let` 和 `const` 声明变量
- 掌握五种基本数据类型
- 灵活运用条件语句和循环语句
