const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

exports.handler = async (event, context) => {
    let result = [];
    let resultUrls = null;
    let browser = null;
    let searchWord = event.pathParameters.txt;

    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        let page = await browser.newPage();
        
        //1,googleページへ
        await page.goto('https://google.co.jp/',{ waitUntil: 'networkidle2' });
        
        //2,検索ワード入力
        await page.type('input[title="検索"]', searchWord + " site:soundcloud.com");

        //3,検索ボタンをクリック
        await page.evaluate(() => {
            document.querySelector('input[value^="Google"]').click();
        });

        //4,ページ遷移待ち DOMが呼び出されるまで
        await page.waitForNavigation({timeout: 30000, waitUntil: "domcontentloaded"});

        //5,恐らくページ1には最大9つの検索結果が出る? class"g" の内部aタグ指定
        const anchors = await page.$$(".g > * > * > a");

        //6,href取得
        const urls = [];
        for (let i = 0; i < anchors.length; i++) {
            urls.push(await (await anchors[i].getProperty('href')).jsonValue());
        }

        resultUrls = urls;

    } catch (error) {
        return context.fail(error);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }


    // resultのsoundcloudURLの加工(search除とpathの階層整理)
    resultUrls.forEach((url)=>{
        const baseArtistUrl = url;
        const baseSoundCloudUrl = "https://soundcloud.com/";
        
        if(url.indexOf(baseSoundCloudUrl) === -1){
            // もしsoundcloudのURLじゃなければ
            return;
        }

        const afterDomainUrl = url.replace(baseSoundCloudUrl,"");
        if(afterDomainUrl.indexOf("search/") !== -1 || afterDomainUrl.indexOf("search?") !== -1){
            // searchというアーティスト名 検索結果系は 一旦除外
            return;
        }
        if(afterDomainUrl.indexOf("/") !== -1){
            // スラッシュを一つでも含んでいればスラッシュ前のアーティスト名のみをサウンドクラウドURLに付けたものをreturn
            result.push( baseSoundCloudUrl + afterDomainUrl.split("/")[0] );
            return;
        } else {
            result.push(baseArtistUrl);
        }
    })
    
    // 処理終了
    return context.succeed({
        "headers": {
            "Access-Control-Allow-Origin" : "*", // 変えてね
            "Access-Control-Allow-Methods": "GET",
        },
        'statusCode': 200,
        'body': JSON.stringify(result)
    });
};