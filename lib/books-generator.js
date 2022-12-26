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

async function resolv(url, timeout, headers) {
    var response = '';
    try {
        response = await request(url, {
            timeout: timeout,
            dataType: 'xml',
            headers: {
                'Referer': url,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
                'Cookie': headers['Cookie']
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

    if (headers['Cookie'] instanceof Array && headers['Cookie'].length === 0) {
        headers['Cookie'] = response.headers['set-cookie']
    }

    var $ = cheerio.load(response.data.toString());
    var items = $('.interest-list .subject-item');
    var list = [];
    var next = $('.paginator .next a').attr('href') || '';
    if (next.startsWith("/")) {
        next = "https://book.douban.com" + next;
    }
    items.each(function (idx, el) {
        const $el = cheerio.load(this);
        var title = $el('.info h2 a').attr('title') || '';
        var alt = $el('info h2 a').attr('href') || '';
        var image = $el('div.pic a img').attr('src') || '';
        var pub = $el('div.pub').text() || '';
        var updated = $el('span.date').text() || '';
        var tags = $el('span.tags').text() || '';
        tags = tags ? tags.substring(3) : '';
        var recommend = $el('short-note div span[class*=rating]').attr('class') || '';
        recommend = renderStar(recommend.substring(6, 1));
        var comment = $el('p.comment').text() || '';

        list.push({
            title: title,
            alt: alt,
            image: image,
            pub: pub,
            updated: updated,
            tags: tags,
            recommend: recommend,
            comment: comment
        });
    });

    return {
        'list': list,
        'next': next
    };
}

module.exports = async function (locals) {
    var startTime = new Date().getTime();
    var config = this.config;
    if (!config.douban || !config.douban.book) {//当没有输入book信息时，不进行数据渲染。
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


    var wish = [];
    var read = [];
    var reading = [];
    var headers = {
        'Cookie': []
    };

    var readingUrl = 'https://book.douban.com/people/' + config.douban.user + '/do';
    var wishUrl = 'https://book.douban.com/people/' + config.douban.user + '/wish';
    var readUrl = 'https://book.douban.com/people/' + config.douban.user + '/collect';

    for (var nextreading = readingUrl; nextreading;) {
        var resreading = await resolv(nextreading, timeout, headers);
        nextreading = resreading.next;
        reading = reading.concat(resreading.list);
        await sleep(300);
    }
    console.log(`在读: ${reading.length}`);

    for (var nextWish = wishUrl; nextWish;) {
        var resWish = await resolv(nextWish, timeout, headers);
        nextWish = resWish.next;
        wish = wish.concat(resWish.list);
        await sleep(300);
    }
    console.log(`想读: ${wish.length}`);

    for (var nextread = readUrl; nextread;) {
        var resread = await resolv(nextread, timeout, headers);
        nextread = resread.next;
        read = read.concat(resread.list);
        await sleep(300);
    }
    console.log(`读过: ${read.length}`);

    var endTime = new Date().getTime();

    var offlinePrompt = offline ? ", because you are offline or your network is bad" : "";

    var sum = wish.length + reading.length + read.length;
    log.info(`${sum} books have been loaded in ` + (endTime - startTime) + " ms" + offlinePrompt);
    if (!sum) return;

    var __ = i18n.__(config.language);

    var contents = ejs.renderFile(path.join(__dirname, 'templates/book.ejs'), {
        'quote': config.douban.book.quote,
        'wish': wish,
        'read': read,
        'reading': reading,
        '__': __,
        'root': root
    },
        function (err, result) {
            if (err) console.log(err);
            return result;
        });

    return {
        path: 'books/index.html',
        data: {
            title: config.douban.book.title,
            content: contents,
            slug: 'books'
        },
        layout: ['page', 'post']
    };
};
