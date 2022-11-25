'use strict';

var request = require('urllib-sync').request;
var ejs = require('ejs');
var xpath = require('xpath');
var path = require('path');
var Dom = require('xmldom').DOMParser;
var renderStar = require('./util').renderStar;
var i18n = require('./util').i18n;
var offline = false;

var log = require('hexo-log')({
    debug: false,
    silent: false
});

function resolv(url, timeout) {
    var response = '';
    try {
        response = request(url, {
            timeout: timeout,
            dataType: 'xml'
        });
    } catch (err) {
        offline = true;
    }

    if (offline) {
        return {
            list: [],
            next: ""
        };
    }

    var doc = new Dom({
        errorHandler: {
            warning: function (e) {
            },

            error: function (e) {
            },

            fatalError: function (e) {
            }
        }
    }).parseFromString(response.data.toString());

    var items = xpath.select('//div[@class="grid-view"]/div[@class="item"]', doc);
    var next = xpath.select('string(//span[@class="next"]/a/@href)', doc);
    if (next.startsWith("/")) {
        next = "https://album.douban.com" + next;
    }

    var list = [];
    for (var i in items) {
        var parser = new Dom().parseFromString(items[i].toString());
        var title = xpath.select1('string(//li[@class="title"]/a/em)', parser);
        var alt = xpath.select1('string(//li[@class="title"]/a/@href)', parser);
        var image = xpath.select1('string(//div[@class="item"]/div[@class="pic"]/a/img/@src)', parser).replace('ipst', 'spst');

        var tags = xpath.select1('string(//li/span[@class="tags"])', parser);
        tags = tags ? tags.substr(3) : '';
        var date = xpath.select1('string(//li/span[@class="date"])', parser);
        date = date ? date : '';

        var recommend = xpath.select1('string(//li/span[starts-with(@class,"rating")]/@class)', parser);
        recommend = renderStar(recommend.substr(6, 1));
        var comment = xpath.select1('string(//li/span[@class="comment"])', parser);
        comment = comment ? comment : '';

        var info = xpath.select1('string(//li[@class="intro"])', parser);
        info = info ? info : '';

        //image = 'https://images.weserv.nl/?url=' + image.substr(8, image.length - 8) + '&w=100';

        list.push({
            title: title,
            alt: alt,
            image: image,
            tags: tags,
            date: date,
            recommend: recommend,
            comment: comment,
            info: info
        });
    }

    return {
        'list': list,
        'next': next
    };
}

module.exports = function (locals) {

    var config = this.config;
    if (!config.douban || !config.douban.album) {//当没有输入album信息时，不进行数据渲染。
        return;
    }

    var root = config.root;
    if (root.endsWith('/')) {
        root = root.slice(0, root.length - 1);
    }

    var timeout = 10000;
    if (config.douban.timeout) {
        timeout = config.douban.timeout;
    }

    var startTime = new Date().getTime();
    var wish = [];
    var listened = [];
    var listening = [];

    var wishUrl = 'https://music.douban.com/people/' + config.douban.user + '/wish';

    for (var nextWish = wishUrl; nextWish;) {
        var resWish = resolv(nextWish, timeout);
        nextWish = resWish.next;
        wish = wish.concat(resWish.list);
    }
    console.log(`想听: ${wish.length}`);

    var listeningUrl = 'https://music.douban.com/people/' + config.douban.user + '/do';

    for (var nextListening = listeningUrl; nextListening;) {
        var resListening = resolv(nextListening, timeout);
        nextListening = resListening.next;
        listening = listening.concat(resListening.list);
    }
    console.log(`在听: ${listening.length}`);

    var listenedUrl = 'https://music.douban.com/people/' + config.douban.user + '/collect';

    for (var nextListened = listenedUrl; nextListened;) {
        var resListened = resolv(nextListened, timeout);
        nextListened = resListened.next;
        listened = listened.concat(resListened.list);
    }
    console.log(`听过: ${listened.length}`);

    var endTime = new Date().getTime();

    var offlinePrompt = offline ? ", because you are offline or your network is bad" : "";

    log.info(`${wish.length + listening.length + listened.length} albums have been loaded in` + (endTime - startTime) + ' ms' + offlinePrompt);

    var __ = i18n.__(config.language);

    var contents = ejs.renderFile(path.join(__dirname, 'templates/album.ejs'), {
        'quote': config.douban.album.quote,
        'wish': wish,
        'listened': listened,
        'listening': listening,
        '__': __,
        'root': root
    },
        function (err, result) {
            if (err) console.log(err);
            return result;
        });

    return {
        path: 'albums/index.html',
        data: {
            title: config.douban.album.title,
            content: contents,
            slug: 'albums'
        },
        layout: ['page', 'post']
    };
};
