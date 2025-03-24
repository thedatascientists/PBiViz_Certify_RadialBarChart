/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {

  public generalView: maximumValueSettings = new maximumValueSettings()
  public labelFormatting: labelFormatting = new labelFormatting()
  public labelValueFormatting: labelValueFormatting = new labelValueFormatting()
  public labelSeparator: labelSeparatorFormatting = new labelSeparatorFormatting()
  public numberLabels: numberLabels = new numberLabels()
  public radialSettings: radialSettings = new radialSettings();
  public lineSettings: lineSettings = new lineSettings()
  public referenceLine: referenceLine = new referenceLine()
  public iconHome: iconHome = new iconHome()
  public targetSettings: targetSettings = new targetSettings()
  public targetTitle: targetTitleSettings = new targetTitleSettings()
  public animationSettings: animationSettings = new animationSettings()
  public tooltipSettings: tooltipSettings = new tooltipSettings()
  public secondMeasureSettings: secondMeasureSettings = new secondMeasureSettings()
  
}

// Settings for the maximum value displayed
export class maximumValueSettings {
  public totalValueType: string = "fixed"
  public categoryToTotal: boolean = true
  public fixedTotal: number = 20000000
}


// Settings for the labels
export class labelFormatting {
  public showLabels : boolean = true 
  public labelAlignment: string = "center"
  public size: number = 10
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#000000" 
  public fontFamily: string = "'Segoe UI Bold', wf_segoe-ui_bold, helvetica, arial, sans-serif"
}

export class labelValueFormatting {
  public showLabels : boolean = true 
  public size: number = 10
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#000000" 
  public fontFamily: string = "'Segoe UI Bold', wf_segoe-ui_bold, helvetica, arial, sans-serif"
  public showPercentages: string = "number" 
  public displayUnits: string = "dynamic" 
  public decimalPlaces: number = 1
}

export class labelSeparatorFormatting {
  public size: number = 10
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#000000" 
  public fontFamily: string = "'Segoe UI Bold', wf_segoe-ui_bold, helvetica, arial, sans-serif"
}


export class numberLabels {
  public showNumbers: boolean = true
  public size: number = 9
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#000000"
  public fontFamily: string = "'Segoe UI Light', wf_segoe-ui_light, helvetica, arial, sans-serif"
  public quarterUnits: string = "dynamic"
  public decimalPlaces: number = 1
}

export class radialSettings {
  public activateDrilldown: boolean = true
  public shadowVisible: string = "shadow"
  public shadowColor: string = "#FFFFFF"
  public shadowOpacity: number = 30
  public radius: number = 24
  public startingOpacity: number = 20
  public opacitySteps: number = 10
  public colorScheme: string = "hexaColor"
}

export class lineSettings {
  public lineVisible: boolean = false
  public linecolor: string = "#E6E6E6"
  public linethickness: number = 0.1
}

export class referenceLine {
  public showReferenceLines: boolean = true
  public sonarLinesColor: string = "#000000"
  public sonarOpacity: number = 10
  public sonarLineWidth: number = 1
  public dashline: number = 5
}

export class iconHome {
  public x_position: number = 15
  public y_position: number = 10
  public default_icon: boolean = true
  public allowGoBack_category: boolean = false
  public allowGoBack_label: boolean = false
  public allowGoBack_blank_space: boolean = false
  public size: number = 20
  public defaultIcon: string = "data:image/png;base64,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"

  
  public show_label = true
  public label_size: number = 11
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#7e7e7e"
  public fontFamily: string = "'Segoe UI Light', wf_segoe-ui_light, helvetica, arial, sans-serif"
}

export class targetSettings{     
  public showTarget: boolean = false
  public targetType: string = "fixed"
  public quarterUnits: string = "default"   
  public decimalPlaces: number = 1
  public fixedTarget: number = 50
  public targetLineColor: string = "#E00000"
  public targetLineOpacity: number = 30
  public targetLineWidth: number = 4
  public showLabel: boolean = true
  public fontSize: number = 15
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#000000"
  public fontFamily: string = "'Segoe UI Light', wf_segoe-ui_light, helvetica, arial, sans-serif"
}

export class targetTitleSettings{     
  public title: string = "Target Value: "
  public fontSize: number = 15
  public textWeight: boolean = false
  public fontUnderline: boolean = false
  public fontItalic: boolean = false
  public fontColor: string = "#000000"
  public fontFamily: string = "'Segoe UI Light', wf_segoe-ui_light, helvetica, arial, sans-serif"
}

export class animationSettings { 
  public enableAnimations: boolean = true
  public duration: number = 0.5
}

export class tooltipSettings {
  public showExtraValue: boolean = true    
  public showDescription: boolean = false
  public description: string = ""
  public titleDescription: string = ""
  public titleMeasure: string = ""
  public removeMeasure: boolean = false
  public removeCategory: boolean = false
  public tooltipUnits: string = ".2s"
  public decimalPlaces: number = 0
}

export class secondMeasureSettings {
  public showValue: string = "second"
  public labelUnits: string = "default"
  public quarterUnits: string = "0.0%"
  public tooltipUnits: string = "default"
  public decimalPlaces: number = 0
}
