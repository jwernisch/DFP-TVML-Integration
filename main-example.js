const main = (() => {

  /*
   * Public Functions
   */
  let categoryData = [];
  let initialCategoryData = [];
  let updateResumeItems = [];

  const handleSelectedMediaItem = (selectedMediaItem) => {
    pushPage(loadingTemplate.init(selectedMediaItem.title, selectedMediaItem.thumbnailUrlSmall));

    let mediaItem = main.categoryData[selectedMediaItem.rowIndex].movies[selectedMediaItem.itemIndex];
    if (mediaItem.isCollection) {
      if (!mediaItem.episodes) {
        getJSON(mediaItem.url, (data) => {
          let episodesPayloadData = JSON.parse(data).movies;
          main.categoryData[selectedMediaItem.rowIndex].movies[selectedMediaItem.itemIndex].episodes = episodesPayloadData;
          // SNIPPED

          // Don't pushPage if loading screen has been dismissed
          if (getActiveDocument().getElementById('loadingScreen')) {
            if (!episodesPayloadData) {
              pushPage(createAlert(config.screens.alerts.noEpisodesTitle, config.screens.alerts.noEpisodesDesc));
            } else {
              pushPage(seriesSpringboard.init(selectedMediaItem));
            }
          }
        }, failCallbackMulti);
      } else {
        pushPage(seriesSpringboard.init(selectedMediaItem));
      }
    } else {
      pushPage(springboard.init(selectedMediaItem));
    }
  };

  /*
   * Private Functions
   */
  const init = () => {

    let screenName = style().main;
    let styles = createStyles(screenName);

    const getPayload = () => {
      let expandedURLs = [];
      let slicedCategoryData = main.categoryData.slice(config.initialRowCount);
      // SNIPPED
      let slicedRequestedURLs = requestedURLs.slice(config.initialRowCount);
      for (let index = 0, len = slicedRequestedURLs.length; index < len; index++) {
        let sumIndex = index+config.initialRowCount;
        getJSON(slicedRequestedURLs[index], (data) => {
          main.categoryData[sumIndex].movies = JSON.parse(data).movies;
          // SNIPPED

          createLockups(sumIndex, main.categoryData[sumIndex].movies, 'episodeLockup');
        }, failCallbackMulti);
      }
    };

    const createLockups = (index, videos, lockupType, initialLoad) => {
      let thisDoc;
      if (initialLoad === true) {
        thisDoc = parsedTemplate;
      } else {
        thisDoc = getActiveDocument();
      }

      if (thisDoc === undefined ||
        thisDoc.getElementById('mainScreen') === undefined ||
        main.categoryData[index].movies === undefined ||
        thisDoc.getElementsByTagName('section').item(index).getElementsByTagName('lockup').item(0).getAttribute('data-rowType') !== 'placeholder') {
        return;
      } else {
        let rowList = '';
        for (let lockupIndex in videos) {
          let currentLockup = videos[lockupIndex];
          let lockupName = currentLockup.title;
          let lockupSlider = currentLockup.thumbnailCarousel;
          let lockupPoster = currentLockup.thumbnailUrlLarge;
          let resumeTime = currentLockup.resumeTime;
          let progressBar = '';

          if (resumeTime !== 0) {
            progressBar = `<progressBar class="progress-bar" value="${resumeTime}" />`;
          }

          if (index === 0) {
            rowList += `<lockup data-rowType="${lockupType}" data-index="${lockupIndex}" class="carousel-lockup">
              <img class="image featured-image" src="${lockupSlider}" width="${config.screens.main.featuredImageWidth}" height="${config.screens.main.featuredImageHeight}" />
              <overlay class="overlay">
                <title class="featured-name" accessibilityText="${lockupName}">${lockupName}</title>
                ${progressBar}
              </overlay>
            </lockup>`;
          } else {
            rowList += `<lockup data-rowType="${lockupType}" data-index="${lockupIndex}">
              <img class="image" src="${lockupPoster}" width="${config.screens.main.standardImageWidth}" height="${config.screens.main.standardImageHeight}" />
              <overlay class="overlay">
                ${progressBar}
              </overlay>
              <title class="subtitle" accessibilityText="${lockupName}">${lockupName}</title>
            </lockup>`;
          }
        }

        // add lockups to rows, replace placeholders if present
        let targetRow = thisDoc.getElementsByTagName('collectionList').item(0).getElementsByTagName('shelf').item(index);
        let placeHolder = targetRow.getElementsByTagName('lockup').item(0);
        placeHolder.parentNode.removeChild(placeHolder);
        targetRow.getElementsByTagName('section').item(0).insertAdjacentHTML('beforeend', rowList);
      }
    };

    const createRows = () => {
      let categoryData = main.categoryData;
      let section = '';

      for (let rowIndex in categoryData) {
        let rowHeader = '';
        let rowFooter = '';
        let rowTitle = cleanXml(categoryData[rowIndex].title);

        if (rowIndex === '0') {
          rowHeader = `<shelf class="carousel-shelf" data-rowIndex="${rowIndex}">
            <section>
              <lockup data-rowType="placeholder">
                <img class="image featured-image" width="${config.screens.main.featuredImageWidth}" height="${config.screens.main.featuredImageHeight}" />
                <overlay class="overlay">
                  <title class="featured-name" accessibilityText="Loading Content">Loading Content</title>
                </overlay>
              </lockup>`;
        } else {
          rowHeader = `<shelf centered="false" class="${rowIndex === '1' ? 'first-row-shelf ' : ''}row-shelf" data-rowIndex="${rowIndex}">
            <section>
              <header>
                <text class="title" accessibilityText="${rowTitle}">${rowTitle}</text>
              </header>
              <lockup data-rowType="placeholder">
                <img class="image" width="${config.screens.main.standardImageWidth}" height="${config.screens.main.standardImageHeight}" />
                <title class="subtitle" accessibilityText="Loading Content">Loading Content</title>
              </lockup>`;
        }

        rowFooter = `</section>
        </shelf>`;

        section += rowHeader + rowFooter;
      }

      return section;
    };

    const handleSelectEvent = (event) => {
      if (event.target.hasAttribute('data-rowType') === false) return;
      main.handleSelectedMediaItem(getTargetMediaItem(event));
    };

    let xml = `<?xml version="1.0" encoding="UTF-8" ?>
    <document id="mainScreen">
      <head>
        <style>
        ${styles}
        </style>
      </head>
      <stackTemplate class="stackTemplate">
        <banner class="mvpd-image-holder">
          <row id="mvpdImageHolder"><img class="logo" src="resource://pff-logo" width="${config.screens.main.logoImageWidth}" height="${config.screens.main.logoImageHeight}" /></row>
        </banner>
        <collectionList class="collectionList">
        ${createRows()}
        </collectionList>
      </stackTemplate>
    </document>`;
    /* END XML Template */

    let templateParser = new DOMParser();
    let parsedTemplate = templateParser.parseFromString(xml, "application/xml");

    // parse template then populate the rows
    for (let i = 0; i < config.initialRowCount; i++) {
      createLockups(i, main.categoryData[i].movies, 'episodeLockup', true);
    }

    parsedTemplate.addEventListener("appear", function() {
      analytics.sendPageViewTracking('ScreenView', {'title':'Home', 'path':'/', 'mvpd':'OpenAccess'});
      screenHelpers.updateResumeLockups('mainScreen');
      popPage('divTemplate');

      for (let i = 0; i < main.categoryData.length; i++) {
        createLockups(i, main.categoryData[i].movies, 'episodeLockup');
      }
    }, false);
    parsedTemplate.addEventListener("load", (event) => {
      getPayload();
    }, false);
    parsedTemplate.addEventListener("select", handleSelectEvent, false);
    clearTimeout(loadingTemplate.loadingTimer);
    clearTimeout(initTimer);

    return parsedTemplate;
  };

  return {
    categoryData: categoryData,
    initialCategoryData: initialCategoryData,
    updateResumeItems: updateResumeItems,
    handleSelectedMediaItem: handleSelectedMediaItem,
    init: () => {
      return init();
    }
  };
})();
