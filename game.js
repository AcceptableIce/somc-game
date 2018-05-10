document.addEventListener("DOMContentLoaded", () => {
  // The number of data points to show on the horizontal axis before scrolling.
  const xDataPointLimit = 100;
  // The average delay (in in-game days) between new news items.
  const averageNewsDelay = 1;
  // The average delay (in in-game days) between new actionable events.
  const averageEventDelay = 1;
  // The number of ticks per second.
  const tickrate = 10; 
  // The number of ticks in an in-game day.
  const ticksPerDay = 20;
  // Prefixes for partisanship scores: 0-24, 25-49, 50-74, 75-99, 100.
  const partisanshipTerms = ["Slightly", "Moderately", "Heavily", "Overwhelmingly", "Completely"]

  const margin = {
    top: 10,
    right: 50,
    bottom: 50,
    left: 0
  };
  const baseElement = document.querySelector("#overview-graph");
  const width = baseElement.offsetWidth - margin.left - margin.right;
  const height = baseElement.offsetHeight - margin.top - margin.bottom;

  const svg = d3.select("#overview-graph")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("id", "visualization")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const x = d3.scale.linear().domain([0, xDataPointLimit]).range([0, width]);
  const y = d3.scale.linear().domain([0, 100]).range([height, 0]);
  const xAxis = d3.svg.axis().scale(x).orient("bottom").innerTickSize(-height).outerTickSize(0).tickPadding(10).tickFormat(getDisplayDate).ticks(5);
  const yAxis = d3.svg.axis().scale(y).orient("right").innerTickSize(-width).outerTickSize(0).tickPadding(10).ticks(4);

  const line = d3.svg.line()
    .interpolate("cardinal")
    .x((d, i) => x(i))
    .y(d => y(d));

  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.top + margin.bottom - 20)
    .style("text-anchor", "middle")
    .text("Historical Date")

  svg.append("g")
    .attr("class", "y axis")
    .attr("transform", `translate(${width}, 0)`)
    .call(yAxis);

  svg.append("path")
    .attr("id", "update-path")
    .attr("stroke", "#D25656")
    .attr("stroke-width", 2)
    .attr("fill", "none");

  svg.selectAll(".y .tick:last-of-type line").remove();
  svg.selectAll(".tick line").attr("stroke-dasharray", "2, 2");

  function resetPlayer() {
    return {
      partisanship: 0,
      transparency: 25,
      opinion: 25,
      decisionHistory: [],
      news: [],
      activeEvent: true,
      historicalData: [],
      tick: 0,
      lastNewsTick: 0,
      lastEventTick: 0
    };
  }

  const content = {
    news: [],
    events: [],
    endConditions: []
  };

  let player = resetPlayer();

  function calculatePlayerScore() {
    return (100 - Math.abs(player.partisanship) + player.transparency + player.opinion) / 3;
  }

  function updateStatDisplay(stat, value) {
    document.querySelector(`#stat-${stat} .value`).innerHTML = value.toFixed(2);
  }

  function getDisplayDate(tick) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startDate = new Date();

    startDate.setDate(startDate.getDate() + Math.floor(tick / ticksPerDay));

    return `${monthNames[startDate.getMonth()]} ${startDate.getDate()}`;
  }

  function updateStats(data) {
    if(data) {
      player.partisanship += data.partisanship || 0;
      player.transparency += data.transparency || 0;
      player.opinion += data.opinion || 0;

      if(player.partisanship < -100) player.partisanship = -100;
      if(player.partisanship > 100) player.partisanship = 100;

      if(player.transparency < 0) player.transparency = 0;
      if(player.opinion < 0) player.opinion = 0;
    }
  }

  function showNewsStory() {
    const unshownNews = _.difference(content.news, player.news);

    if(unshownNews.length > 0) {
      const newStory = _.sample(unshownNews);

      player.news.push(newStory);

      const newsElement = document.createElement("div");
      newsElement.className = "news-item";

      const newsDate = document.createElement("div");
      newsDate.className = "date";
      newsDate.innerHTML = getDisplayDate(player.tick);
      
      const newsTitle = document.createElement("div");
      newsTitle.className = "title";
      newsTitle.innerHTML = newStory.headline;

      const newsBody = document.createElement("div");
      newsBody.className = "body";
      newsBody.innerHTML = newStory.body;

      newsElement.appendChild(newsDate);
      newsElement.appendChild(newsTitle);
      newsElement.appendChild(newsBody);

      const currentEvents = document.querySelector(".current-events");
      currentEvents.insertBefore(newsElement, currentEvents.firstChild);

      updateStats(newStory.modifiers);
    }

    player.lastNewsTick = player.tick;
  }

  function selectEventOption(option) {
    player.decisionHistory.push({
      option,
      original: player.activeEvent
    });

    updateStats(option.modifiers);

    player.activeEvent = undefined;

    document.querySelector(".current-action .body").innerHTML = "You have no pending messages.";
    document.querySelector(".current-action .choices").innerHTML = "";

    const historyElement = document.createElement("div");
    historyElement.className = "history-item";

    const historyDate = document.createElement("div");
    historyDate.className = "date";
    historyDate.innerHTML = getDisplayDate(player.tick);

    const historyBody = document.createElement("div");
    historyBody.className = "body";
    historyBody.innerHTML = option.description;

    historyElement.appendChild(historyDate);
    historyElement.appendChild(historyBody);

    const historyList = document.querySelector(".history-list")
    historyList.insertBefore(historyElement, historyList.firstChild);
  }

  function checkSinglePrerequisite(prerequisite, playerValue) {
    if(prerequisite !== undefined) {
      if(prerequisite[0] === "<") {
        return playerValue < Number(prerequisite.substr(1));
      } else if( prerequisite[0] === ">") {
        return playerValue > Number(prerequisite.substr(1));
      } else {
        return playerValue === Number(prerequisite);
      }
    } else {
      return true;
    }
  }

  function hasPrerequisites(event) {
    if(event.prerequisites) {
      return checkSinglePrerequisite(event.prerequisites.partisanship, player.partisanship) &&
        checkSinglePrerequisite(event.prerequisites.transparency, player.transparency) &&
        checkSinglePrerequisite(event.prerequisites.opinion, player.opinion);
    } else {
      return true;
    }
  }

  function showEvent() {
    const unshownEvents = _.difference(content.events.filter(hasPrerequisites), player.decisionHistory.map(x => x.original));

    if(unshownEvents.length > 0) {
      const newEvent = _.sample(unshownEvents);

      player.activeEvent = newEvent;

      document.querySelector(".current-action .body").innerHTML = newEvent.body.split("\n")
        .map(part => `<p>${part}</p>`).join("");
      
      const actionContainer = document.querySelector(".current-action .choices");

      actionContainer.innerHTML = "";
      newEvent.options.forEach(option => {
        const optionElement = document.createElement("button");
        optionElement.className = "action-choice";
        optionElement.onclick = selectEventOption.bind(this, option);

        const optionText = document.createElement("span");
        optionText.innerHTML = option.label;

        optionElement.appendChild(optionText);

        actionContainer.appendChild(optionElement);
      });
    }

    player.lastEventTick = player.tick;
  }

  function checkEndConditions() {
    const metConditions = content.endConditions.filter(x => hasPrerequisites(x));
    
    if(metConditions.length && player.decisionHistory.length >= 3) {
      const endCondition = metConditions[0];

      document.querySelector(".modal .title").innerHTML = endCondition.title;
      document.querySelector(".modal .body").innerHTML = endCondition.body.split("\n")
        .map(part => `<p>${part}</p>`).join("");
      document.querySelector(".modal .submit span").innerHTML = "Play Again";

      const content = document.querySelector(".content");
      content.classList.remove("turn-on");
      content.classList.add("turn-off");
      document.querySelector(".modal").classList.remove("hidden");

      player.activeEvent = true;
      
      return true;
    }

    return false;
  }

  function updateData() {
    const data = player.historicalData;

    if(!player.activeEvent) {
      data.push(calculatePlayerScore() * (1.05 - Math.random() * 0.1));
      player.tick = data.length;

      x.domain([Math.max(0, data.length - xDataPointLimit), data.length > xDataPointLimit ? data.length : xDataPointLimit]);
      svg.selectAll(".x.axis").call(xAxis);
      svg.selectAll(".tick line").attr("stroke-dasharray", "2, 2");

      svg.select("#update-path")
        .attr("d", line(data));

      if(player.partisanship === 0) {
        document.querySelector("#stat-partisanship .value").innerHTML = "Neutral";
      } else {
         document.querySelector("#stat-partisanship .value").innerHTML = partisanshipTerms[Math.floor(Math.abs(player.partisanship) / 25)] + (player.partisanship > 0 ? " Social Democratic" : " Neoconservative");
      }

      updateStatDisplay("transparency", player.transparency);
      updateStatDisplay("opinion", player.opinion);

      if(!checkEndConditions()) {
        if(player.tick - player.lastNewsTick > averageNewsDelay * ticksPerDay + Math.random() * 100) {
          showNewsStory();
        }
        
        if(player.tick - player.lastEventTick > averageEventDelay * ticksPerDay + Math.random() * 100) {
          showEvent();
        }
      }
    }
  }

  // Load content file.
  const xhr = new XMLHttpRequest();
  xhr.open("get", "content.json", true);
  xhr.onreadystatechange = function() {
    if(xhr.readyState === 4) {
      if(xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);

        content.news = data.news;
        content.events = data.events;
        content.endConditions = data.endConditions;

        setInterval(updateData, 1000 / tickrate);
      }
    }
  };

  xhr.send();

  // Wire modal on-click.
  document.querySelector(".modal .submit").onclick = function() {
    const content = document.querySelector(".content");

    player = resetPlayer();

    player.activeEvent = undefined;

    document.querySelector(".modal").classList.add("hidden");
    content.classList.remove("hidden");
    content.classList.add("turn-on");

    document.querySelector(".current-events").innerHTML = "";
    document.querySelector(".history-list").innerHTML = "";
  }
});