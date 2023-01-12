'use strict';

const {log} = require('@cyc/utils');

module.exports = core;

async function core() {
    // TODO..
    try {
        await prepare();
    } catch(e) {
        log.error(e.message)
    }
}

async function prepare() {

}
