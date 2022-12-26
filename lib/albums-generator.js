'use strict';

var request = require('request-promise');
var ejs = require('ejs');
var cheerio = require('cheerio');
var path = require('path');
var { renderStar, i18n, sleep } = require('./util');
var offline = false;

var log = require('hexo-log')({
    debug: false,
    silent: false
});

async function resolv(url, timeout) {
    var response = '';
    try {
        response = await request(url, {
            timeout: timeout,
            dataType: 'xml',
            headers: {
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            }
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

    var $ = cheerio.load(response);
    var items = $('.grid-view .item');
    var list = [];
    var next = $('span.next a').attr('href') || '';

    items.each(function (idx, el) {
        const $el = cheerio.load(this);
        var title = $el('li.title a em').text() || '';
        var alt = $el('li.title a').attr('href') || '';
        var image = $el('div.pic a img').attr('src') || '';
        var tags = $el('li span.tags').text() || '';
        tags = tags ? tags.substring(3) : '';
        var date = $el('li span.date').text() || '';
        date = date ? date : '';
        var recommend = $el('li span[class*=rating]').attr('class') || '';
        recommend = renderStar(recommend.substring(6, 1));
        var comment = $el('li span.comment').text() || '';
        comment = comment ? comment : '';
        var info = $el('li.intro').text() || '';
        info = info ? info : '';

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
    });

    return {
        'list': list,
        'next': next
    };
}

module.exports = function (locals) {
    var startTime = new Date().getTime();
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

    var rawUrl = 'https://music.douban.com/people/' + config.douban.user;
    var wishUrl = rawUrl + '/wish';
    var listeningUrl = rawUrl + '/do';
    var listened = rawUrl + '/collect';

    var wish = [];
    var listened = [];
    var listening = [];
    for (var nextWish = wishUrl; nextWish;) {
        var resWish = await resolv(nextWish, timeout);
        nextWish = resWish.next;
        wish = wish.concat(resWish.list);
        await sleep(300);
    }
    console.log(`想听: ${wish.length}`);

    for (var nextListening = listeningUrl; nextListening;) {
        var resListening = await resolv(nextListening, timeout);
        nextListening = resListening.next;
        listening = listening.concat(resListening.list);
        await sleep(300);
    }
    console.log(`在听: ${listening.length}`);

    for (var nextListened = listenedUrl; nextListened;) {
        var resListened = await resolv(nextListened, timeout);
        nextListened = resListened.next;
        listened = listened.concat(resListened.list);
        await sleep(300);
    }
    console.log(`听过: ${listened.length}`);

    var endTime = new Date().getTime();

    var offlinePrompt = offline ? ", because you are offline or your network is bad" : "";

    var sum = wish.length + listening.length + listened.length;
    log.info(`${sum} albums have been loaded in ` + (endTime - startTime) + ' ms' + offlinePrompt);
    if (!sum) return;

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
