"use strict";

const fs = require("fs");
// 命令行提示选择
const inquirer = require("inquirer");
// 用于删除目录
const fse = require("fs-extra");
// 用于处理版本号
const semver = require("semver");
// homedir
const os = require("os");
// npm package download
const npminstall = require("npminstall");
const { log, exec } = require("@cyc-cli/utils");
const path = require("path");
// loading
const ora = require("ora");
const glob = require("glob");
const ejs = require("ejs");

// 常量
const TYPE_PROJECT = "project";
const TYPE_COMPONENT = "component";
const TEMPLATE_TYPE_NORMAL = "normal";
const WHITE_COMMAND = ["npm", "cnpm"];

// 模板列表
const projectTemplateList = [
  {
    name: "vue2标准模板",
    npmName: "cyc-cli-template-vue2",
    version: "0.1.1",
    type: "normal",
    installCommand: "npm install",
    startCommand: "npm run serve",
  },
  {
    name: "vue3标准模板",
    npmName: "cyc-cli-template-vue3",
    version: "0.1.0",
    type: "normal",
    installCommand: "npm install",
    startCommand: "npm run serve",
  },
];

module.exports = core;

async function core() {
  try {
    // 1.准备阶段
    const res = await prepare();
    // 2.下载阶段（下载模板到本地）
    if (res) {
      const downloadInfo = await downloadTemplate(res);
      // 3.安装模版
      await installTemplate(downloadInfo);
    }
  } catch (e) {
    log.error(e.message);
  }
}

async function prepare() {
  const localPath = process.cwd();

  // 1. 判断当前目录是否为空
  if (!isDirEmpty(localPath)) {
    const { isContinue } = await inquirer.prompt([
      {
        type: "confirm",
        name: "isContinue",
        default: false,
        message: "当前文件夹不为空，是否继续创建？",
      },
    ]);

    if (!isContinue) return null;

    // 二次确认
    const { isDelete } = await inquirer.prompt([
      {
        type: "confirm",
        name: "isDelete",
        default: false,
        message: "是否确认清空当前目录？",
      },
    ]);
    // 清空当前目录
    if (isDelete) fse.emptyDirSync(localPath);
  }

  return getProjectInfo();
}

function isDirEmpty(localPath) {
  let fileList = fs.readdirSync(localPath);
  fileList = fileList.filter((fileName) => {
    return !fileName.startsWith(".") && ["node_modules"].indexOf(fileName) < 0;
  });

  return !fileList || fileList.length === 0;
}

async function getProjectInfo() {
  let projectInfo = {};
  const { type } = await inquirer.prompt([
    {
      type: "list",
      name: "type",
      message: "请选择类型",
      default: TYPE_PROJECT,
      choices: [
        {
          name: "项目",
          value: TYPE_PROJECT,
        },
        {
          name: "组件",
          value: TYPE_COMPONENT,
        },
      ],
    },
  ]);

  if (type === TYPE_PROJECT) {
    const project = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "请输入项目名称",
        default: "",
        validate: function (v) {
          const done = this.async();
          setTimeout(function () {
            // \w=a-zA-Z0-9_
            if (!/^[a-zA-Z][\w-]*[a-zA-Z0-9]+$/.test(v)) {
              done("请输入合法的项目名称！");
              return;
            }
            done(null, true);
          }, 0);
        },
      },
      {
        type: "input",
        name: "projectVersion",
        message: "请输入版本号",
        default: "1.0.0",
        filter: function (v) {
          return semver.clean(v) || v;
        },
        validate: function (v) {
          return !!semver.valid(v);
        },
      },
      {
        type: "list",
        name: "templateNpmName",
        message: "请选择模板",
        choices: projectTemplateList.map((v) => ({
          name: v.name,
          value: v.npmName,
        })),
      },
    ]);

    projectInfo = {
      type,
      ...project,
      projectNameLowCase: require("kebab-case")(project.projectName).replace(
        /^-/,
        ""
      ),
    };
  } else if (type === TYPE_COMPONENT) {
    // 创建模板
  }

  return projectInfo;
}

async function downloadTemplate(projectInfo) {
  const templateInfo = projectTemplateList.find(
    (v) => (v.npmName = projectInfo.templateNpmName)
  );

  const targetPath = path.resolve(os.homedir(), ".cyc-cli", "template");
  const storeDir = path.resolve(
    os.homedir(),
    ".cyc-cli",
    "template",
    "node_modules"
  );

  //   const spinner = ora("下载中..").start();
  //   await new Promise((resolve) => setTimeout(resolve, 2000));
  //   spinner.stop();

  await npminstall({
    // install root dir
    root: targetPath,
    // optional packages need to install, default is package.json's dependencies and devDependencies
    pkgs: [{ name: templateInfo.npmName, version: templateInfo.version }],
    // install to specific directory, default to root
    // targetDir: '/home/admin/.global/lib',
    // link bin to specific directory (for global install)
    // binDir: '/home/admin/.global/bin',
    // registry, default is https://registry.npmjs.org
    registry: "https://registry.npmmirror.com",
    // debug: false,
    storeDir,
    // ignoreScripts: true, // ignore pre/post install scripts, default is `false`
    // forbiddenLicenses: forbit install packages which used these licenses
  });
  log.info("下载模版完成！");

  return {
    projectInfo,
    templateInfo,
    targetPath,
    storeDir,
  };
}

async function installTemplate(arg) {
  const { projectInfo, templateInfo, targetPath, storeDir } = arg;

  const templatePath = path.resolve(
    storeDir,
    ".store",
    `${templateInfo.npmName}@${templateInfo.version}`,
    "node_modules",
    templateInfo.npmName,
    "template"
  );
  const projectPath = process.cwd();
  fse.ensureDirSync(templatePath);
  fse.ensureDirSync(projectPath);

  if (templateInfo.type === TEMPLATE_TYPE_NORMAL) {
    // --常规安装--
    // 将包拷贝到目录下
    fse.copySync(templatePath, projectPath);

    // ejs渲染
    await ejsRender({
      ignore: ["**/node_modules/**", "public/**"],
      data: projectInfo,
    });

    // 依赖安装
    await execCommand(templateInfo.installCommand);
    // 启动命令
    await execCommand(templateInfo.startCommand);
  } else if (templateInfo.type === TEMPLATE_TYPE_NORMAL) {
    // --自定义安装--
  }
}

function checkCommand(cmd) {
  return WHITE_COMMAND.indexOf(cmd) > -1;
}

async function execCommand(command) {
  const installCmd = command.split(" ");
  const cmd = installCmd[0];
  const args = installCmd.slice(1);

  if (!checkCommand(cmd)) {
    throw new Error("command 命令不合法!");
  }

  const r = await new Promise((resolve, reject) => {
    const p = exec(cmd, args, { stdio: "inherit", cwd: process.cwd() });
    p.on("exit", (v) => resolve(v));
    p.on("error", (e) => reject(e));
  });
  console.log(r);

  if (r !== 0) {
    throw new Error("执行 command 命令失败!");
  }
}

async function ejsRender(options) {
  return new Promise((resolve, reject) => {
    glob(
      "**",
      {
        cwd: process.cwd(),
        ignore: options.ignore || ["**/node_modules/**"],
        nodir: true,
      },
      (err, files) => {
        if (err) {
          reject(err);
        }
        Promise.all(
          files.map((file) => {
            const filePath = path.resolve(process.cwd(), file);
            return new Promise((resolve1, reject1) => {
              ejs.renderFile(filePath, options.data || {}, (err1, res1) => {
                if (err1) {
                  reject1(err1);
                } else {
                  fse.writeFileSync(filePath, res1);
                  resolve1(res1);
                }
              });
            });
          })
        )
          .then(() => {
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
      }
    );
  });
}
