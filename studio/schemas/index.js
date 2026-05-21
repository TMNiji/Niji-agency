// Schema bundle — exported as a flat array consumed by sanity.config.js.
import homePage   from './homePage.js';
import siteConfig from './siteConfig.js';
import section    from './section.js';
import award      from './award.js';
import client     from './client.js';
import teamMember from './teamMember.js';

export const schemaTypes = [homePage, siteConfig, section, award, client, teamMember];
