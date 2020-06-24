function channelSelected(channelId) {
  var newChannel = null;
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].id == channelId) {
      newChannel = channels[i];
      break;
    }
  }
  if (newChannel == selectedChannel) {
    console.log('Same channel!');
    return;
  } else if (!newChannel) {
    return;
  }

  if (selectedChannel) {
    selectedChannel.unselected();
  }
  closeEpg();
  player.attachSource(newChannel.dashUrl);
  newChannel.channelSelected();
  selectedChannel = newChannel;
}

window.onload = function () {
  $('.epg').hide();
  $('.menubar').hide();
  // loadServicelist("../../backend/servicelist.php");
  loadServicelist('../example.xml');
  // getMyServicelist('http://172.30.1.21:3000/channel');
  uiHideTimeout = setTimeout(hideUI, 5000);
  $('.video_wrapper').on('click touchstart', resetHideTimeout);
  var video = document.getElementById('video');
  player = dashjs.MediaPlayer().create();
  player.initialize(video);
  player.setAutoPlay(true);

  // 초기 스타트 화면 인터페이스 이벤트 핸들러
  hideFullScreen();
  // setTimeout(hideFullScreen, 2000);
};
var selectedChannel = null;
var channels = [];
var epg = null;
var uiHideTimeout = null;
var player;
var streamInfoUpdate = null;

function resetHideTimeout() {
  if ($('.player-ui').hasClass('hide') && $('.epg').hasClass('hide')) {
    $('.player-ui').removeClass('hide');
  }
  clearTimeout(uiHideTimeout);
  uiHideTimeout = setTimeout(hideUI, 5000);
}

function hideUI() {
  if (!$('.player-ui').hasClass('hide')) {
    $('.player-ui').addClass('hide');
  }
}

function showEpg(service) {
  $('.epg').removeClass('hide');
  $('.player-ui').addClass('hide');
  $('.epg').show();
  $('.grid').show();
  $('.grid').append(epg.showChannel(service));
  var epgdate = new Date(epg.start * 1000);
  $('#epg_date').text(epgdate.getDate() + '.' + (epgdate.getMonth() + 1) + '.');
  if (epg.displayIndex == 0) {
    $('#previous_channel').addClass('end');
  } else if (epg.displayIndex >= epg.channels.length - 3) {
    $('#next_channel').addClass('end');
  }
}

function closeEpg() {
  $('.epg').hide();
  if (!$('.epg').hasClass('hide')) {
    $('.epg').addClass('hide');
  }
  if (!$('.programinfo').hasClass('hide')) {
    $('.programinfo').addClass('hide');
  }
  $('.player-ui').removeClass('hide');
}

function showNext() {
  if (!epg.showNextChannel()) {
    if (!$('#next_channel').hasClass('end')) {
      $('#next_channel').addClass('end');
    }
  } else if ($('#previous_channel').hasClass('end')) {
    $('#previous_channel').removeClass('end');
  }
}

function showPrevious() {
  if (!epg.showPreviousChannel()) {
    if (!$('#previous_channel').hasClass('end')) {
      $('#previous_channel').addClass('end');
    }
  } else if ($('#next_channel').hasClass('end')) {
    $('#next_channel').removeClass('end');
  }
}

function nextDay() {
  epg.showNextDay();
  var epgdate = new Date(epg.start * 1000);
  $('#epg_date').text(epgdate.getDate() + '.' + (epgdate.getMonth() + 1) + '.');
}

function previousDay() {
  epg.showPreviousDay();
  var epgdate = new Date(epg.start * 1000);
  $('#epg_date').text(epgdate.getDate() + '.' + (epgdate.getMonth() + 1) + '.');
}

function closeProgramInfo() {
  $('.programinfo').addClass('hide');
  $('.grid').show();
}

function openProgramInfo(program) {
  program.populateProgramInfo();
  $('.grid').hide();
  $('.programinfo').removeClass('hide');
}

function loadServicelist(list) {
  $.get(
    list,
    async (data) => {
      const maxLcn = 0;
      debugger;
      // loadServicelist 안으로 넣어서 하나의 함수로 실행하게 수정. 
      // getMyServicelist 를 비동기 처리 
      const {list: firstServices, maxLcn: max} = parseServiceList(data, null, maxLcn);
      debugger;

      const {list: secondServices, maxLcn: resultMaxLcn} = await getMyServicelist('http://172.30.1.21:3000/channel', max);
      //sperad 연산자. 두 개의 서비스를 통합 
      const services = [...firstServices, ...secondServices];

      debugger;
      var channelIndex = 0;
      for (var i = 0; i < services.length; i++) {
        var channel = new Channel(services[i], channelIndex++);
        channels.push(channel);
      }
      channels.sort(compareLCN);
      channelSelected(channels[0].id);

      populate();
      epg = new EPG(channels);
    },
    'text',
  );
}

const getMyServicelist = async (url, maxLcn) => {
    const lists = await fetch(url, { headers: { 'Content-Type': 'text/plain' } })
    .then(async (response) => {
      // 전체 채널 리스트 목록 변수
      const list = [];
      let services = await response.json();
      const serviceList = services.ServiceList;
      const lcnList = serviceList.LCNTableList[0].LCNTable[0].LCN;
      const contentGuideSource = serviceList.ContentGuideSource[0];
      services = serviceList.Service;

      if (services.length > 0) {
        for (let i = 0; i < services.length; i++) {
          const obj = {
            code: i,
            contentGuidServiceRef: services[i].ContentGuideServiceRef[0],
            contentGuideURI: contentGuideSource.ScheduleInfoEndpoint[0].URI[0],
            dashUrl: '',
            epg: [],
            id: services[i].UniqueIdentifier[0],
            lcn: '',
            sourceTypes: [],
            title: services[i].ServiceName[0],
          };

          const relatedMaterial = services[i].RelatedMaterial;
          for (let j = 0; j < relatedMaterial.length; j++) {
            const howRelated = relatedMaterial[j]['tva:HowRelated'][0].$.href;

            if (howRelated == 'urn:dvb:metadata:cs:HowRelatedCS:2019:1001.2') {
              obj.image = relatedMaterial[j]['tva:MediaLocator'][0]['tva:MediaUri'][0]._;
            }
          }

          for (let j = 0; j < services[i].ServiceInstance.length; j++) {
            let sourceType = services[i].ServiceInstance[0].SourceType[0];
            if (sourceType === 'urn:dvb:metadata:source:dvb-dash') {
              obj.sourceTypes.push('DVB-DASH');
              obj.dashUrl =
                services[i].ServiceInstance[0].DASHDeliveryParameters[0].UriBasedLocation[0].URI[0];
            }
          }

          debugger;
          for (let j = 0; j < lcnList.length; j++) {
            if (lcnList[j].$.serviceRef === obj.id) {
              obj.lcn = parseInt(lcnList[j].$.channelNumber);
              if (obj.lcn > maxLcn) {
                maxLcn = obj.lcn;
              }
            }
          }
          list.push(obj);
        }
        console.log(list);
        return {list, maxLcn};
      }
    })
    .catch((error) => {
      console.error(error);
    });
    debugger;
    return lists;
}

function populate() {
  // var listElement = document.getElementById('channel_list');
  // for (var i = 0; i < channels.length; i++) {
  //   var channel = channels[i];
  //   listElement.appendChild(channel.element);
  // }
  setTimeout(refresh, (60 - new Date().getSeconds()) * 1000);
}

function refresh() {
  updateOpenChannel();
  setTimeout(refresh, (60 - new Date().getSeconds()) * 1000);
}

function updateOpenChannel() {
  if (selectedChannel) {
    selectedChannel.updateChannelInfo();
  }
}

function showStreamInfo() {
  $('#streaminfo').show();
  updateStreamInfo();
  streamInfoUpdate = setInterval(updateStreamInfo, 1000);
}

function hideStreamInfo() {
  clearInterval(streamInfoUpdate);
  $('#streaminfo').hide();
}

function updateStreamInfo() {
  if (player) {
    try {
      var audioTrack = player.getBitrateInfoListFor('audio')[player.getQualityFor('audio')];
      var videoTrack = player.getBitrateInfoListFor('video')[player.getQualityFor('video')];
      var bestAudio = player.getTopBitrateInfoFor('audio');
      var bestVideo = player.getTopBitrateInfoFor('video');
      if (audioTrack) {
        document.getElementById('audio_bitrate').innerHTML =
          audioTrack.bitrate / 1000 + 'kbits (max:' + bestAudio.bitrate / 1000 + 'kbits)';
      }
      if (videoTrack) {
        document.getElementById('video_bitrate').innerHTML =
          videoTrack.bitrate / 1000 + 'kbits (max:' + bestVideo.bitrate / 1000 + 'kbits)';
        document.getElementById('video_resolution').innerHTML =
          videoTrack.width +
          'x' +
          videoTrack.height +
          ' (max:' +
          bestVideo.width +
          'x' +
          bestVideo.height +
          ')';
      }
      document.getElementById('live_latency').innerHTML = player.getCurrentLiveLatency() + 's';
    } catch (e) {
      document.getElementById('audio_bitrate').innerHTML = 'error';
      document.getElementById('video_bitrate').innerHTML = 'error';
      document.getElementById('video_resolution').innerHTML = 'error';
      document.getElementById('live_latency').innerHTML = '';
    }
  } else {
    document.getElementById('audio_bitrate').innerHTML = 'unavailable';
    document.getElementById('video_bitrate').innerHTML = 'unavailable';
    document.getElementById('video_resolution').innerHTML = 'unavailable';
    document.getElementById('live_latency').innerHTML = 'unavailable';
  }
}

function compareLCN(a, b) {
  if (a.lcn > b.lcn) return 1;
  if (b.lcn > a.lcn) return -1;

  return 0;
}

function hideFullScreen() {
  console.log('start', document.querySelector('#fullScreen'), channels[0]);
  document.querySelector('#fullScreen').classList.add('hide-screen');
}

// 1. 다수개의 서비스 리스트를 모으고, 채널을 할당 
//   - 유투브나 3rd party app 링크(iframe?) 등으로 하나의 채널번호를 보여줄 수 있음. 
//   - 핸드폰에서도 재생 가능 : 브라우저 위에서 해당 소스들을 받을 수 있도록 (현재 소스내에 안드로이드라고 폴더가 있음).   
//     모바일 웹, player 를 서버에 넣고 접속해서  HTML 플레이 페이지를 받아오는 형태 