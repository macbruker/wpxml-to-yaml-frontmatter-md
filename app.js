'use strict';

var request = require('request'),
         fs = require('fs-extra'),
    cheerio = require('cheerio'),
     moment = require('moment'),
     yamljs = require('yamljs');

var body = fs.readFileSync('wordpress-xml/your-xml-here.xml').toString();
var $ = cheerio.load(body, { xmlMode: true });

var channel = $('channel');

// Each post in XML
$('item', channel).each(function() {
  var item = $(this);

  // Main body text
  var content = item.find('content\\:encoded').html();
  var content = content.replace("<![CDATA[", "").replace("]]>", "");

  // Download Images
  var images = [];
  var wysiwyg = cheerio.load(content);

  wysiwyg('img').each(function(i, el) {
    var image = $(this).attr('src');
    var imagename = image.replace(/(?:(?:http|https)[.:]?[/.a-z-]+[/0-9]+)([a-z0-9.-]+)/igm, "$1");
    var imagename = 'images/' + imagename;
    // console.log(imagename + ': ' + image + '\n');

    var download = function(uri, filename, callback){
      request.head(uri, function(err, res, body){
        // console.log('content-type:', res.headers['content-type']);
        // console.log('content-length:', res.headers['content-length']);

        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
      });
    };

    download(image, imagename, function(i) {
      // console.log('Image' + i + 'done');
    });
  });





  /**
   * Cleanup Content
   * ---------------------------------------------------------------------------
   */

  // Trim leading and trailing whitespace
  var content = content.trim(); //.replace(/^\s+|\s+$/g, '');

  // Replace [caption] with <figure> & <figcaption> http://regexr.com/3cepk
  var content = content.replace(/(?:\[+[a-z ="_0-9]+\])(\<.+\>)([^\[]+)(?:.+)/gm, "<figure>$1<figcaption>$2</figcaption></figure>");

  // Replace image link href absolute url with relative url http://regexr.com/3ceq6
  var content = content.replace(/(\<a href\=\")(?:(?:http|https)[.:]?[/.a-z-]+[/0-9]+)([a-z0-9.-]*(?:jpg|png)+)([^>]+\>)/igm, "$1{{assets}}images/$2$3");

  // Replace image src absolute url with relative url http://regexr.com/3ceq0
  var content = content.replace(/(\<img src\=\")(?:(?:http|https)[.:]?[/.a-z-]+[/0-9]+)([a-z0-9.-]+)(\"[^>]+\/>)/igm, "$1{{assets}}images/$2$3");

  // Replace [quote] with blockquote + footer
  var content = content.replace(/(?:\[quote[^\"]+.)([^\"]+)(?:\"\])([^\[]+)(?:\[\/quote\])/gm, "<blockquote>\n\t$2\n\t<footer>$1</footer>\n</blockquote>\n");

  // Comments
  var comments = [];
  var comment = item.find('wp\\:comment').each(function() {
    var comment = $(this);
    var comment_data = [
      '\n  -',
      '    comment_id: "' + comment.find('wp\\:comment_id').text() + '"',
      '    comment_author: "' + comment.find('wp\\:comment_author').text() + '"',
      '    comment_author_email: "' + comment.find('wp\\:comment_author_email').text() + '"',
      '    comment_author_url: "' + comment.find('wp\\:comment_author_url').text() + '"',
      '    comment_date: "' + comment.find('wp\\:comment_date').text() + '"',
      '    comment_content: |',
      '      ' + comment.find('wp\\:comment_content').html().replace("<![CDATA[", "").replace("]]>", "")
    ].join('\n');
    comments.push(comment_data)
  });
  if (comments.length > 0) { var comments = 'comments:\n' + comments.join(" "); }
  // console.log(comments);


  // Pubdate
  var pubdate = moment(new Date(item.find('pubDate').text())).format('YYYY-MM-DD-HHmm');
  // console.log(pubdate);


  // Output format
  var frontmatter = [
    '---',
    'title: "' + item.find('title').text() + '"',
    'creator: "' + item.find('dc\\:creator').text().trim() + '"',
    'post_id: "' + item.find('wp\\:post_id').text() + '"',
    'excerpt: "' + item.find('excerpt\\:encoded').text() + '"',
    comments,
    '---',
    content
  ].join('\n');

  // See how it looks
  // console.log(frontmatter);

  var filename = pubdate + '-' + item.find('wp\\:post_name').text();
  // saveToFile(filename, frontmatter);
});



function saveToFile(filename, content) {
  fs.writeFile('content/' + filename + '.md', content, function(error){
    if(error) {
      console.log(error);
    } else {
      console.log('File "' + filename + '.md" saved to "content/".');
    }
  });
};
