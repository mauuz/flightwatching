const {sendEmail} = require('./mail')
const axios  = require('axios')
const {redisClient} = require('./redis')
class Flight {
    priceDownList = []
    async search(fromDate,toDate){
        let result = await axios({
            method:'POST',
            url:'https://m.ctrip.com/restapi/soa2/19728/fuzzySearch',
            headers:{
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/535.1 (KHTML, like Gecko) Chrome/14.0.835.163 Safari/535.1'
            },
            data:{
                "tt": 1,
                "source": "online_budget",
                "st": 18,
                "segments": [
                    {
                        "dcs": [
                            {
                                "name": "吉隆坡",
                                "code": "KUL",
                                "ct": 1
                            }
                        ],
                        "acs": [
                            {
                                "ct": 3,
                                "code": "DOMESTIC_ALL",
                                "name": "全中国"
                            }
                        ],
                        "dow": [],
                        "sr": null,
                        "drl": [
                            {
                                "begin": fromDate,
                                "end": toDate
                            }
                        ],
                        "ddate": null
                    }
                ],
                "filters": null,
                "head": {
                    "cid": "09031025213723318174",
                    "ctok": "",
                    "cver": "1.0",
                    "lang": "01",
                    "sid": "8888",
                    "syscode": "999",
                    "auth": "",
                    "xsid": "",
                    "extension": []
                }
            }

        })
        if(result.data.ResponseStatus.Ack === "Success"){

            await redisClient.connect()
            for (let i=0;i<result.data.routes.length;i++){
                let a = result.data.routes[i]
                console.log(a.arriveCity.provinceName + a.arriveCity.name)
                console.log("id:"+a.arriveCity.id)
                // //检查是否为新加航班
                // if(await new Flight().checkIfIsNew(a.arriveCity.id)){
                //
                // }

                let price = []
                for(let i = 0;i <a.pl.length ;i++){
                    price.push({price:a.pl[i].price,index:i,url:a.pl[i].jumpUrl,date:a.pl[i].departDate})
                }
                price.sort((a,b)=>{return a.price-b.price})


                let priceObj = await new Flight().checkIfPriceDecreasing(redisClient,a.arriveCity.id,price[0].price)
                console.log(priceObj)
                if(priceObj){
                    this.priceDownList.push({
                        city:a.arriveCity.provinceName + a.arriveCity.name,
                        price:price[0].price,
                        previousPrice:priceObj.previousPrice,
                        url:price[0].url,
                        time:price[0].date
                    })
                }
                // console.log("最低价:"+price[0].price)
                // console.log("链接:"+price[0].url)
                // console.log()
            }
            await redisClient.disconnect()

            let content = await new Flight().parseObj(this.priceDownList)
            if(content){
                await sendEmail('cme1909117',content)
            }
        }else {
            return false
        }

    }

    async checkIfPriceDecreasing(redisClient,id,price){
        let previousPrice = await redisClient.get(id.toString())
        if(previousPrice){
            if(parseFloat(previousPrice)>parseFloat(price)){
                await redisClient.set(id.toString(),price.toString())
                return {previousPrice}
            }else  {
                return false
            }
        }else{
            await redisClient.set(id.toString(),price.toString())
            return {previousPrice:'无'}
        }
    }

    async parseObj(list){
        if(list.length > 0){
            let str = ''
            for(let i =0;i<list.length;i++){
                str += `出发地:${list[i].city}</br> 价格:${list[i].previousPrice} -> ${list[i].price} </br> 出发时间:${list[i].time}</br> 链接:${list[i].url} </br></br>`
            }
            return str
        }else {
            return false
        }
    }
}


async function Run(){
    await new Flight().search('2023-1-1','2023-1-14')
}
setInterval(()=>{
    console.log("开始监视.............")
    Run()
},30000)

