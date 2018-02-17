const adHelpers = (() => {

  /*
   * Public Functions
   */
  const handleVmap = (guid) => {

    // Build VMAP Url
    const getVmapURL = (guid = config.ads.defaultGuid) => {
       // SNIPPED
    };

    const getVmapData = (guid) => {
      return new Promise ((resolve, reject) => {
        getJSON(getVmapURL(guid),
          (data) => {
            resolve(parseResponse(data));
          }, (url) => { //failCallBack
            reject(url);
          },
          {
            // SNIPPED
          } // headers
        );
      });
    };

    const formatVmapResponse = (adBreak) => {
      adBreak = adBreak['vmap:VMAP']['vmap:AdBreak'];
      let adSet = [];
      for (let index = 0, len = adBreak.length; index < len; index++) {
        adSet.push({
          'allowMultipleAds' : adBreak[index]['vmap:AdSource'].allowMultipleAds,
          'breakId' : adBreak[index].breakId,
          'followRedirects' : adBreak[index]['vmap:AdSource'].followRedirects,
          'timeOffset' : adBreak[index].timeOffset,
          'vastUrl' : adBreak[index]['vmap:AdSource']['vmap:AdTagURI']['#cdata-section']
        });
      }
      setAdResponse(adSet);
    };

    const setAdResponse = (adSet) => {
      let output = [];
      // Push to output Array, after combining objects with `breakId` key
      adSet.forEach((vastUrl) => {
        let existing = output.filter((v) => {
          return v.breakId == vastUrl.breakId;
        });
        if (existing.length) {
          let existingIndex = output.indexOf(existing[0]);
          output[existingIndex].vastUrl = output[existingIndex].vastUrl.concat(vastUrl.vastUrl);
        } else {
          if (typeof vastUrl.vastUrl == 'string')
            vastUrl.vastUrl = [vastUrl.vastUrl];
          output.push(vastUrl);
        }
      });
      adHelpers.adResponse = output;
    };

    // Promises are handled here:
    // Get Vmap, then format it, then get creatives
    getVmapData(guid)
      .then((adBreak) => {
        formatVmapResponse(adBreak);
      }).then(() => {
        // Get only the preroll on init
        // Call adHelpers.getVastAdData(breakIdIndex) to init other cuepoints
        adHelpers.getVastAdData(0);
      })
      .catch(() => {
        failCallbackMulti(url);
      });
  // END handleVmap
  };

  // Get associated tracking before sending to player
  const getTrackingEvents = (desiredCreatives) => {
    let creative;
    let trackingEvents = [];

    const getTrackingData = (trackingKey, trackingNode) => {
      if (trackingNode.length) {
        for (let i = 0, len = trackingNode.length; i < len; i++) {
          trackingEvents.push({[trackingKey] : trackingNode[i]['#cdata-section']});
        }
      } else {
        trackingEvents.push({[trackingKey] : trackingNode['#cdata-section']});
      }
    };

    for (let i = 0, len = desiredCreatives.length; i < len; i++) {
      let desiredCreative = desiredCreatives[i];
      let creativeNode = desiredCreative.InLine.Creatives.Creative;
      let trackingHolder = {};

      trackingEvents = [];

      if (Array.isArray(creativeNode)) {
        for (let i = 0, len = creativeNode.length; i < len; i++) {
          if (creativeNode[i].Linear) {
            creative = creativeNode[i].Linear;
          }
        }
      } else {
        creative = creativeNode.Linear;
      }

      if (creative.TrackingEvents && !objectIsEmpty(creative.TrackingEvents.Tracking)) {
        trackingHolder = creative.TrackingEvents.Tracking;
      } else {
        trackingHolder = creativeNode.Tracking;
      }

      if (!objectIsEmpty(trackingHolder)) {
        let trackingError = {};
        let trackingImpression = {};

        if (desiredCreative.InLine.Impression) {
          getTrackingData('impression', desiredCreative.InLine.Impression);
        }

        if (desiredCreative.InLine.Error) {
          getTrackingData('error', desiredCreative.InLine.Error);
        }

        for (let i = 0, len = trackingHolder.length; i < len; i++) {
          let eventType = trackingHolder[i].event;
          let eventLink = trackingHolder[i]['#cdata-section'];
          let trackingObj = {[eventType] : eventLink};
          trackingEvents.push(trackingObj);
        }
      }

      let mediaFiles = creative.MediaFiles.MediaFile;

      desiredCreative.vastPod = {mediaFiles, trackingEvents};
    }

    adHelpers.createAdPlaylist(desiredCreatives);
  };

  const createAdPlaylist = (desiredCreatives) => {
    let adPlaylist =[];

    for (let i = 0, len = desiredCreatives.length; i < len; i++) {
      let adData = {};
      let adDataArray = [];
      let adDuration;
      let desiredCreative = desiredCreatives[i];
      let vastPod = desiredCreative.vastPod;
      let adBase = desiredCreative.InLine;
      let adSystem = typeof adBase.AdSystem === 'string' ? adBase.AdSystem : adBase.AdSystem['#text'];
      let adTitle = adBase.AdTitle ? (adBase.AdTitle['#cdata-section'] ? adBase.AdTitle['#cdata-section'] : adBase.AdTitle) : 'Unknown';
      let adDescription = adBase.Description ? (adBase.Description['#cdata-section'] ? adBase.Description['#cdata-section'] : adBase.Description) : adTitle;

      if (Array.isArray(adBase.Creatives.Creative)) {
        for (let i = 0, len = adBase.Creatives.Creative.length; i < len; i++) {
          if (adBase.Creatives.Creative[i].Linear) {
            adDuration = adBase.Creatives.Creative[i].Linear.Duration;
          }
        }
      } else {
        adDuration = adBase.Creatives.Creative.Linear.Duration;
      }

      if (vastPod.mediaFiles.length) {
        for (let i = 0, len = vastPod.mediaFiles.length; i < len; i++) {
          // SNIPPED
        }

        // If there is no m3u8 found
        if (objectIsEmpty(adData)) {
          for (let i = 0, len = vastPod.mediaFiles.length; i < len; i++) {
            // SNIPPED
          }

          // Find highest bitrate ad in adDataArray
          if (adDataArray.bitrate) {
            let highestBitrate = Math.max(...adDataArray.map(object => object.bitrate));
            adData = adDataArray.find(object => object.bitrate == highestBitrate);
          } else {
            adData = adDataArray[0];
          }
        }
      } else {
        adData = {
          breakId : desiredCreative.breakType,
          tracking : vastPod.trackingEvents,
          title : adTitle,
          id : desiredCreative.id,
          url : vastPod.mediaFiles['#cdata-section']
        };
      }

      if (!objectIsEmpty(adData)) {
        adPlaylist.push(adData);
      }
    }

    if (adPlaylist.length > 0 ) {
      adPlayerControl.pushAdToPlaylist(adPlaylist);
    }
  };

  // get VAST Ad Data for a particular breakId
  const getVastAdData = (breakIdIndex) => {
    let vastAd = adHelpers.adResponse[breakIdIndex] || {};
    let vastAdUrls = vastAd ? vastAd.vastUrl : [];
    let desiredCreatives = [];
    let redirectErrorTracking = [];
    let redirectCount = 0;
    let wrapperTracking = [];

    adHelpers.wrapperError = [];

    // Reset Visual Counter Display
    adPlayerControl.adCount = 0;

    // Notify GA that an ad is being requested
    if (!objectIsEmpty(vastAd)) {
      console.log(vastAd.breakId + ' Request');
      // SNIPPED

      // Follow the DFP Waterfall until we find a valid creative
      const findMediaUrl = (url, index) => {

        return new Promise ((resolve, reject) => {
          let fallbackVASTAds = [];

          // Attempt to find a creative (mediaFile) in an Ad
          // If one is found, resolve the promise, if not run the process again.
          // URL is unnecessary but helps with debugging
          const findCreative = (vastAdObject, url) => {
            if (vastAdObject.hasOwnProperty('Wrapper')) {
              if (vastAd.followRedirects === 'true' && redirectCount < config.ads.maxRedirectsAllowed) {
                redirectCount++;
                wrapperTracking[index] = {
                  'impression' : vastAdObject.Wrapper.Impression,
                  'error' : vastAdObject.Wrapper.Error,
                  'tracking' : vastAdObject.Wrapper.Creatives.Creative.Linear.TrackingEvents.Tracking
                };

                if (vastAdObject.Wrapper.Error) {
                  redirectErrorTracking.push({'error' : vastAdObject.Wrapper.Error['#cdata-section'].replace('[ERRORCODE]', '303')});
                }

                let redirUrl = vastAdObject.Wrapper.VASTAdTagURI['#cdata-section'];
                resolveAds(redirUrl);

                console.log('Redirect found: ', redirUrl);
              } else {
                if (redirectCount === config.ads.maxRedirectsAllowed) {
                  if (vastAdObject.Wrapper.Error) {
                    redirectErrorTracking.push({'error' : vastAdObject.Wrapper.Error['#cdata-section'].replace('[ERRORCODE]', '302')});
                  }
                }

                resolve();

                console.log('Redirect found, follow disabled: ', url);
              }
            } else {
              if (wrapperTracking.length) {
                for (let i in wrapperTracking) {
                  vastAdObject.InLine.Impression = wrapperTracking[i].impression;
                  vastAdObject.InLine.Error = wrapperTracking[i].error;
                  vastAdObject.InLine.Creatives.Creative.Tracking = wrapperTracking[i].tracking;
                }
              }

              for (let i in redirectErrorTracking) {
                adHelpers.wrapperError.push(redirectErrorTracking[i]);
              }

              desiredCreatives.push(vastAdObject);
              fallbackVASTAds = [];
              wrapperTracking = [];
              redirectErrorTracking = [];
              redirectCount = 0;
              resolve();

              console.log('Ad found: ', url);
            }
          };

          // Determine if we have an Ad
          // If so, run findCreative to determine if a valid creative exists
          const resolveAds = (url) => {
            getJSON(url,
              (data) => {
                let vastObj = parseResponse(data);

                if (vastObj.VAST.Ad !== undefined) {
                  // find a node that holds a valid MediaFile
                  // if not found run process again until one is found
                  // SNIPPED
                } else {
                  // No Ad found in this VAST Tag
                  if (fallbackVASTAds.length) {
                    // If allowed, proceed to next Ad after removing it from the Array
                    // SNIPPED
                  } else {
                    reject(url);
                  }
                }
              }, (url, timeout) => { // failCallback
                if (timeout) {
                  console.log("Unable to Resolve URL due to timeout: ", url);
                } else {
                  console.log("Unable to Resolve URL: ", url);
                }

                reject(url);
              },
              {
                // SNIPPED
              }, // headers
              config.ads.adResponseTimeout // timeout
            );
          };

          // Call function
          resolveAds(url);
        })
        .catch((url) => {
          console.log("No Ad found: ", url);

          for (let i in redirectErrorTracking) {
            adHelpers.wrapperError.push(redirectErrorTracking[i]);
          }
          redirectErrorTracking = [];
          wrapperTracking = [];
        });
      };

      async function sendCreative() {
        console.log('vastAdUrls: ', vastAdUrls);
        // We push additional URLs to vastAdUrls as redirects are found
        for (let i = 0; i < vastAdUrls.length; i++) {
          await findMediaUrl(vastAdUrls[i], i);
          console.log('VAST URL Ad query complete: ', vastAdUrls[i]);
        }
        console.log('Waterfall ad search complete, found ' + desiredCreatives.length + ' total URLs.');
        for (let i = 0, len = desiredCreatives.length; i < len; i++) {
          desiredCreatives[i].breakType = adHelpers.breakIdString(adHelpers.adResponse[breakIdIndex].breakId);
        }

        adHelpers.getTrackingEvents(desiredCreatives);
      }

      sendCreative();
      }
  // END getVastAdData
  };


  // Helpers

  // Called from player eventListener
  // If the player is seeking or the ad cannot otherwise be served, it is stored
  // and evaluated. The boundary with highest value will requested.
  const getVastBoundary = (event) => {
    // Loading indicates attempting to resume
    // Paused indicates seeking
    if (event.boundary === 0 || event.target.playbackState === 'loading') return;

    let currentMediaItem = event.target.currentMediaItem;
    if (event.boundary >= playerControl.videoSeekToTime) {
      if (event.target.playbackState === 'paused') {
        adHelpers.boundaryPassedWhileSeeking.push(event.boundary);
      } else {
        // Handles a single passed boundary/cuepoint
        playerControl.videoSeekToTime = event.boundary + 0.001;
        for (let i = 0, len = currentMediaItem.interstitials.length; i < len; i++) {
          if (event.boundary === currentMediaItem.interstitials[i].starttime) {
            adHelpers.getVastAdData(i);
          }
        }
      }
    }
  };

  const breakIdString = (breakIdString) => {
    let formattedBreakIdString = breakIdString.charAt(0).toUpperCase();
    formattedBreakIdString += breakIdString.slice(1);

    if (breakIdString.indexOf('-') !== -1) {
      formattedBreakIdString = formattedBreakIdString.split('-')[0];
    }

    return formattedBreakIdString;
  };

  const parseResponse = (data) => {
    let templateParser = new DOMParser();
    let parsedTemplate = templateParser.parseFromString(data, "application/xml");
    let jsonResponse = adHelpers.xmlToJson(parsedTemplate);

    return jsonResponse;
  };

  /*
   * Private Functions
   */

  // None at this time

  return {
    adResponse: adResponse,
    boundaryPassedWhileSeeking: boundaryPassedWhileSeeking,
    breakIdString: breakIdString,
    createAdPlaylist: createAdPlaylist,
    getTrackingEvents: getTrackingEvents,
    getVastBoundary: getVastBoundary,
    getVastAdData: getVastAdData,
    handleVmap: handleVmap,
    parseResponse: parseResponse,
    wrapperError: wrapperError,
  };

})();
