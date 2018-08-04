const xml2js = require('xml2js/lib/parser');
// const stripPrefix = require('xml2js/lib/processors').stripPrefix;
const _ = require('lodash');

module.exports.parse = function(str) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser(/*{
      xmlns: true,
      tagNameProcessors: [stripPrefix]
    }*/);
    parser.parseString(str, (err, res) => {
      if (err) { return reject(err); }
      return resolve(res);
    });
  });
};

module.exports.get = function(xml, path) {
  return _.get(xml, path);
};

module.exports.children = function(xml) {
  return _.map(xml, (v, k) => {
    return { [k]: v };
  });
};

module.exports.splitPrefix = function(name) {
  return name.replace(/^.*:/, '');
};
