<p align="center">
  <a href="" rel="noopener">
 <img width=200px height=200px src="https://i.imgur.com/6wj0hh6.jpg" alt="Project logo"></a>
</p>

<h3 align="center">ducklab</h3>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![GitHub Issues](https://img.shields.io/github/issues/kylelobo/The-Documentation-Compendium.svg)](https://github.com/kylelobo/The-Documentation-Compendium/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/kylelobo/The-Documentation-Compendium.svg)](https://github.com/kylelobo/The-Documentation-Compendium/pulls)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)

</div>

---

<p align="center"> In-browser data analysis using SQL | Powered by duckdb-wasm
    <br> 
</p>

## 📝 Table of Contents

- [📝 Table of Contents](#-table-of-contents)
- [🧐 About ](#-about-)
- [🏁 Getting Started ](#-getting-started-)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- [🚀 Deployment ](#-deployment-)
- [⛏️ Built Using ](#️-built-using-)
- [🎉 Acknowledgements ](#-acknowledgements-)

## 🧐 About <a name = "about"></a>

DuckLab provides in-browser, SQL notebook experience for adhoc data analysis. It uses duckdb-wasm to process your data within browser. No data leaves your machine.

## 🏁 Getting Started <a name = "getting_started"></a>

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

What things you need to install the software and how to install them.

```
Give examples
```

### Installing

A step by step series of examples that tell you how to get a development env running.

It is recommended to use `pnpm`,

```
# Install pnpm (if you don't have it installed already)
npm i -g pnpm

# install dependencies
pnpm imstall

# Start the dev server
pnpm run dev
```

Or if you are using `npm`
```
# install dependencies
npm install

# start the dev server
npm run dev
```

## 🚀 Deployment <a name = "deployment"></a>

Application has no backend, build can be generated using `pnpm run build` and `dist` folder can be deployed as a static application on any static site hosting.

## ⛏️ Built Using <a name = "built_using"></a>

- [VueJs](https://vuejs.org/) - Web Framework
- [Vuetify](https://vuetifyjs.com/) - Material UI Framework
- [DuckDb](https://duckdb.org/) - In-process database

## 🎉 Acknowledgements <a name = "acknowledgement"></a>

- [duckdb-wasm](https://github.com/duckdb/duckdb-wasm)