const path = require('path')
const htmlParser = require('./parse')

let fs = null
let runJs = null // 执行 js
let env = 'nodejs'

/**
 * 获取当前环境
 */
function getEnv() {
  return env
}

/**
 * 设置 nodejs 环境
 */
function setNodeJsEnv() {
  env = 'nodejs'
  fs = require('fs')
  runJs = filePath => {
    // eslint-disable-next-line import/no-dynamic-require
    require(filePath)
    delete require.cache[require.resolve(filePath)]
  }
}

/**
 * 设置浏览器环境
 */
function setBrowserEnv() {
  env = 'browser'
  fs = {
    readFileSync(filePath) {
      const fileMap = window.__FILE_MAP__ || {}
      return fileMap[filePath] || null
    }
  }
  window.require = runJs = filePath => {
    const content = fs.readFileSync(filePath + '.js')
    if (content) {
      // eslint-disable-next-line no-new-func
      const func = new Function('require', 'module', content)
      const mod = {exports: {}} // modules

      func.call(null, relativePath => {
        const realPath = path.join(path.dirname(filePath), relativePath)
        return window.require(realPath)
      }, mod)

      return mod.exports
    }

    return null
  }
}

try {
  if (typeof global === 'object' && typeof process === 'object') {
    // nodejs
    setNodeJsEnv()
  } else {
    // 浏览器
    setBrowserEnv()
  }
} catch (err) {
  // 浏览器
  setBrowserEnv()
}

/**
 * 读取文件
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    return null
  }
}

/**
 * 读取 json
 */
function readJson(filePath) {
  try {
    const content = readFile(filePath)
    return JSON.parse(content)
  } catch (err) {
    return null
  }
}

/**
 * 转换 rpx 单位为 px 单位
 */
function transformRpx(style) {
  return style.replace(/(\d+)rpx/ig, '$1px')
}

/**
 * 外链的wxss转成内链
 */
function transformWxs(content, componentPath) {
  try {
    // 先简单判断有没有wxs标签
    if (content.indexOf('<wxs') === -1) return content
    // 使用htmParse解析，深度判断有没有wxs标签
    let res = getParseResult(content)
    let { startStack, endStack, textStack } = res;
    let i = 0;
    // 找到所有带有src属性的wxs标签
    let wxsArr = content.match(/<wxs(\s|\w|=|\"|\')*?src\s*=\s*[\"|\'](\s|\w|\.|\/)*[\"|\'](\s|\w|=|\"|\')*?(\/>|>(\w|\s)*<\/wxs>)/g);
    // 可能同时存在多个wxs标签
    while (i < startStack.length) {
      if (startStack[i].tagName !== 'wxs') {
        i++;
        continue;
      }
      let wxsAttrs = startStack[i].attrs || [];
      // 判断wxs是src外链还是内链，外链src不能为空，小程序同时只支持一种
      let wxsItem = wxsAttrs.find(v => v.name === "src");
      if (!wxsItem || !wxsItem.value) {
        i++;
        continue;
      };
      const wxsModuleName = wxsAttrs.find(v => v.name === "module").value;
      const wxsContent = readFile(path.join(componentPath, '../', wxsItem.value));
      content = content.replace(wxsArr[i], function() {
        return `<wxs module="${wxsModuleName}">${wxsContent}</wxs>`
      })
      i++;
    }
    return content
  } catch (error) {
    console.log(JSON.stringify(error))
    return content
  }
}

function getParseResult(content) {
  let startStack = []
  let endStack = []
  let textStack = []

  htmlParser(content, {
    start(tagName, attrs, unary) {
      startStack.push({ tagName, attrs, unary });
    },
    end(tagName) {
      endStack.push(tagName);
    },
    text(content) {
      content = content.trim();
      if (content) textStack.push(content);
    },
  });

  return { startStack, endStack, textStack };
}
module.exports = {
  getEnv,
  setNodeJsEnv,
  setBrowserEnv,
  runJs,
  readFile,
  readJson,
  transformRpx,
  transformWxs,
}
