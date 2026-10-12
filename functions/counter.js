/**
 * Pages Function 访问统计接口 /counter
 */
export async function onRequest(context) {
  // 绑定的KV变量名，后面后台绑定必须叫 PHOTO_COUNT
  const kv = context.env.PHOTO_COUNT;
  const COUNTER_KEY = "total_visit";

  //读取当前计数
  let raw = await kv.get(COUNTER_KEY);
  let count = raw ? parseInt(raw,10) : 0;
  count = count + 1;

  //写回KV存储
  await kv.put(COUNTER_KEY, String(count));

  //跨域允许你的域名访问
  return new Response(JSON.stringify({total:count}),{
    headers:{
      "Content-Type":"application/json",
      "Access‑Control‑Allow‑Origin":"*",
      "Access‑Control‑Allow‑Methods":"GET"
    }
  })
}
