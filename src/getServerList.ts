'use strict';

//#region -> IMPORTS
import('../config');

import * as https from 'https';
import { URL } from 'url';

import { JSDOM } from 'jsdom';
import chalk from 'chalk';

import logger from '../logger';
import {
  checkers,
  mergers,
  random,
  adders,
  converters,
} from '../utils';
//#endregion

//#region -> DESTRUCTURING
// const { JSDOM } = jsdom;
//#endregion

//#region -> CONFIG
const defaultOptions = {
  hostname: 'otservlist.org',
  method: 'GET',
  path: '/',
  port: 443,
  rejectUnauthorized: false,
};
//#endregion

//#region -> LOGIC
//#region -> HELPERS-APP SPECIFIC
const prepareURL = (host: string, path: string): string =>
  random.checkAndAddHttps(adders.addHost(host, path));
const addToPageList = (host: string, path: string): number =>
  pageList.push(prepareURL(host, path));
const cleanDataReceived = (): number => dataReceived.length = 0;
//#endregion

//#region -> VARIABLES
const dataReceived: string[] = [];
const pageList: string[] = [];
const serverList: string[][] = [];
//#endregion

interface IOptions {
  hostname: string;
  path?: string;
  port?: number;
}

// tslint:disable-next-line:max-func-body-length
const getServerList = async (): Promise<Buffer> => {
  logger.debug(chalk.bold.green('Running getServerList!'));

  const getPages = (options: IOptions): Promise<string[]> => {
    logger.debug('options:', options);

    return new Promise((resolve: (resolve: string[]) => void): void => {
      cleanDataReceived();
      logger.debug('options.hostname:', options.hostname);
      // addToPageList(options.hostname);
      logger.debug('pageList:', pageList);
      const onEnd = (): void => {
        const dataReceivedStr = dataReceived.join('');
        const frag = JSDOM.fragment(dataReceivedStr);
        // tslint:disable-next-line:no-any
        // @ts-ignore
        const pages = frag.querySelector('.pages').querySelectorAll('a');

        for (const prop in pages) {
          if (pages.hasOwnProperty(prop)) {
            const obj = pages[prop];
            const objContent = obj.textContent;
            const hrefVal = obj.getAttribute('href');

            if (
              checkers.stringIsInt(objContent)
              && converters.toInt(objContent) !== 1
              && hrefVal !== null
            ) {
              addToPageList(options.hostname, hrefVal);
            }
          }
        }
      };

      const req = https.request(options);
      req.end();
      req.once('response', (res: NodeJS.Socket) => {
        logger.debug(chalk.bold.green('response!'));
        res.on('data', (data: {}) => {
          logger.debug('data!');
          dataReceived.push(String(data));
        });
        res.once('end', () => {
          onEnd();
          resolve(pageList);
        });
      });
    });
  };
  // tslint:disable-next-line:arrow-return-shorthand
  const getServers = (url: string, options: IOptions): Promise<string[][]> => {
    return new Promise((resolve: (resolve: string[][]) => void): void => {
      cleanDataReceived();
      const newURL = new URL(url);
      const newOptions = {
        ...options,
        hostname: newURL.hostname,
        path: newURL.pathname,
      };
      logger.debug('newOptions ->', newOptions);
      const req = https.request(newOptions);
      req.end();

      const onEnd = (): void => {
        const dataReceivedStr = dataReceived.join('');
        const frag = JSDOM.fragment(dataReceivedStr);
        const thAs = frag.querySelectorAll('th > a');
        const result: string[] = [];
        const lastDotsLength = 3;

        for (const prop in thAs) {
          if (thAs.hasOwnProperty(prop)) {
            const obj = thAs[prop];
            const objContent = obj.textContent;
            const hrefVal = obj.getAttribute('href');

            if (hrefVal !== null && hrefVal.includes('/ots/')) {
              if (objContent !== null && objContent.substr(-lastDotsLength) !== '...') {
                result.push(objContent);
              } else {
                /**
                 * @FIX: getCorrectName not working as expected;
                 * throwing error DOMException.js:38.
                 */
                logger.debug('...:', objContent);
                // getCorrectName(hrefVal);
              }
            }
          }
        }

        logger.debug('result.length:', result.length);

        serverList.push(result);
      };

      req.once('response', (res: NodeJS.Socket) => {
        logger.debug('\\/ response!');
        res.on('data', (data: {}) => {
          logger.debug('\\/ data!');
          dataReceived.push(String(data));
        });
        res.once('end', () => {
          logger.debug('\\/ end!');
          logger.debug('length:', pageList.length);
          onEnd();
          resolve(serverList);
          logger.debug(pageList);
        });
      });
    });
  };

  await getPages(defaultOptions);
  logger.debug('pageList ->', pageList);
  for (const page of pageList) {
    logger.debug();
    logger.debug(chalk.bold.green('Go!'));
    await getServers(page, defaultOptions);
    logger.debug('serverList ->', serverList.length);
  }

  logger.debug('serverList ->', serverList);
  const serverListConcat = mergers.concatArray(serverList);

  logger.debug('serverList Concatenated ->', serverListConcat);

  return serverListConcat;
};
//#endregion

export default getServerList;
