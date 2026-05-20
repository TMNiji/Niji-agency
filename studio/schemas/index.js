// Schema bundle — exported as a flat array consumed by sanity.config.js.
import siteConfig from './siteConfig.js';
import section from './section.js';
import award from './award.js';
import client from './client.js';
import teamMember from './teamMember.js';
import testPage from './testPage.js';

export const schemaTypes = [testPage, siteConfig, section, award, client, teamMember];
