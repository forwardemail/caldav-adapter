const xml2js = require('xml2js/lib/parser');

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

module.exports.splitPrefix = function(name) {
  return name.replace(/^.*:/, '');
};
