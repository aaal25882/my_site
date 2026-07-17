
const form=document.getElementById("profit-calculator");
const money=value=>new Intl.NumberFormat("fa-IR").format(Math.round(value))+" تومان";

function calculate(){
  const productPrice=Number(document.getElementById("product-price").value);
  const orderWeight=Number(document.getElementById("order-weight").value);
  const ticketCost=Number(document.getElementById("ticket-cost").value);
  const capacity=Number(document.getElementById("usable-capacity").value);
  const recovery=Number(document.getElementById("recovery-rate").value);
  const minimum=Number(document.getElementById("minimum-fee").value);

  if(![productPrice,orderWeight,ticketCost,capacity,recovery,minimum].every(Number.isFinite)||orderWeight<=0||capacity<=0){
    return;
  }

  const percentFee=productPrice*0.04;
  const targetTripIncome=ticketCost*recovery;
  const perKgTarget=targetTripIncome/capacity;
  const weightFee=perKgTarget*orderWeight;
  const recommended=Math.max(percentFee,weightFee,minimum);

  document.getElementById("percent-fee").textContent=money(percentFee);
  document.getElementById("weight-fee").textContent=money(weightFee);
  document.getElementById("recommended-fee").textContent=money(recommended);

  let basis="حداقل کارمزد";
  if(recommended===weightFee) basis="سهم وزنی هزینه سفر";
  if(recommended===percentFee) basis="۴ درصد ارزش کالا";
  document.getElementById("calculator-explanation").textContent=
    `مبنای انتخاب در این سفارش: ${basis}. درآمد هدف هر کیلو بار حدود ${money(perKgTarget)} است.`;
}
form.addEventListener("submit",e=>{e.preventDefault();calculate();});
form.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",calculate));
calculate();
