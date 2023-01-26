"use strict";

const { program } = require("commander");
const packageConfig = require("../package");

const { log } = require("@cyc-cli/utils");
const init = require("@cyc-cli/init");

module.exports = core;

async function core() {
  try {
    prepare();
    registerCommand();
  } catch (e) {
    log.error(e.message);
  }
}

function prepare() {}

function registerCommand() {
  program.version(packageConfig.version).usage("<command> [options]");

  program
    .command("init [type]")
    .description("项目初始化")
    .option("--packagePath <packagePath>", "手动指定init包路径")
    .option("--force", "强制安装")
    .action((type, { packagePath, force }) => {
      init({name: type, packagePath, force});
    });

  program.parse(process.argv);
}
