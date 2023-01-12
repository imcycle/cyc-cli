'use strict';

const {log} = require('@cyc/utils');

module.exports = core;

async function core() {
    // 
    try {
        await prepare();
    } catch(e) {
        log.error(e.message)
    }
}

async function prepare() {

}
