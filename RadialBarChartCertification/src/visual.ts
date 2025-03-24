/*
*  Power BI Visual CLI
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

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualEventService = powerbi.extensibility.IVisualEventService;

import * as d3 from "d3";
import { createTooltipServiceWrapper, TooltipEventArgs, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import * as dataViewObjects from "powerbi-visuals-utils-dataviewutils/lib/index";
import * as valueFormatter from "powerbi-visuals-utils-formattingutils";
import { textMeasurementService } from "powerbi-visuals-utils-formattingutils";
import { TextProperties } from "powerbi-visuals-utils-formattingutils/lib/src/interfaces";
import { VisualSettings } from './settings';




interface ViewModel {
    dataPoints: DataPoint[];
    maxValue: number;
    average: number;
    total: number;
};

interface DataPoint {
    accu: number;
    os: string;
    category: string;
    value: number;
    valueSecondMeasure?: number;
    target?: number;
    extraValue: number;
    color?: string;
    format?: valueFormatter.valueFormatter.IValueFormatter;
    identity: powerbi.visuals.ISelectionId;
    tooltips: VisualTooltipDataItem[];
    displayNameCat?: string;
};

interface TotalInfo {
    group: string;
    groupTotal: number;
    active: boolean;
    identity?: powerbi.visuals.ISelectionId;
};

interface datum {
    startAngle?: number;
    endAngle?: number;
    outerRadius?: number;
    identity: powerbi.visuals.ISelectionId;
}

export class Visual implements IVisual {

    //We set up the basic elements that we will need. host page > svg > group
    private host: IVisualHost;
    // private svg: d3.Selection<SVGElement>;
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, unknown>;
    private barGroup: d3.Selection<SVGElement, unknown, HTMLElement, unknown>;

    // Elements for the Arcs
    private circle: d3.Selection<SVGElement, unknown, HTMLElement, unknown>;
    private background: d3.Selection<SVGElement, unknown, HTMLElement, unknown>;

    private legend: d3.Selection<SVGElement, unknown, HTMLElement, unknown>;

    // private barGroup: d3.Selection<SVGElement>;
    private selectionManager: ISelectionManager;

    private events: IVisualEventService;

    private viewModel: ViewModel;

    private categorySelected: boolean;
    private identitySelected: object;
    private selectedCategoryName: string;
    private selectedCategoryColor: string;
    private last_step: string;
    private filteredCategories: Array<string>
    private totalByCategory: Array<TotalInfo>
    private cubeFormat: valueFormatter.valueFormatter.IValueFormatter;
    private cubeFormatIsPercentage: boolean;
    private detailCategorySelected: boolean;

    private tooltipServiceWrapper: ITooltipServiceWrapper;

    private spanElement;
    private svgTextElement;
    private canvasCty;
    private fallbackFontFamily;
    private extraTooltip;
    private existsSecondMeasure;
    private showSecondMeasureSettings;
    private existTargetMetric;
    private valueColumnName = "";

    private visualSettings: VisualSettings;

    private iValueFormatter = valueFormatter;


    defaultCubeFormat: string;
    targetValue: number;
    sortByValues: boolean;
    sortOrder: powerbi.SortDirection;
    elementOptions: HTMLElement;

    // Construct the basic elements
    constructor(options: VisualConstructorOptions) {

        this.host = options.host;  

        this.svg = d3.select(options.element)
            .append("svg")
            .classed("my-little-bar-chart", true)
            

        this.barGroup = this.svg.append("g")
            .classed("bar-group", true);

        this.selectionManager = this.host.createSelectionManager();

        this.background = this.svg
            .append("g")
            .classed("background", true)
        

        this.circle = this.svg
            .append("g")
            .classed("circle", true);

        this.legend = this.svg.append("g").classed("legend", true);

        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        this.categorySelected = false; // variable to know if there is a category that is selected

        this.last_step = "first" // variable to know in which level we are

        this.filteredCategories = []

        this.extraTooltip = null;

        this.cubeFormatIsPercentage = false;

        this.elementOptions = options.element;

        this.events = options.host.eventService;

    }

    public update(options: VisualUpdateOptions) {

        this.events.renderingStarted(options);

        this.visualSettings = VisualSettings.parse<VisualSettings>(options.dataViews[0]);

        const vL = valueFormatter.valueFormatter;

        // get data
        this.viewModel = this.getViewModel(options); 
        const viewModel = this.viewModel;


        // get size of the canvas
        let width = options.viewport.width;
        let height = options.viewport.height;

        this.svg.attr("fill", "transparent")
        

        // creates vertical sidebar
        if (height < 240) {
            height = 240
            this.elementOptions.style.overflowY = 'auto'
            this.svg.attr("width", width)
            this.svg.attr("height", height)

        } else{
            this.elementOptions.style.overflowY = 'hidden'
            this.svg.attr("width", width)
            this.svg.attr("height", height)
        }


        // creates horizontal sidebar
        if (width < 290) {
            width = 290
            this.elementOptions.style.overflowX = 'auto'
            this.svg.attr("width", width)
            this.svg.attr("height", height)
        }else{
            this.elementOptions.style.overflowX = 'hidden'
            this.svg.attr("width", width)
            this.svg.attr("height", height)
        }
        

        this.svg.selectAll("text").remove();
        this.svg.attr("width", width)
            .attr("height", height)

        // Reset all the shapes to avoid artifacts in the update
        d3.selectAll("text").remove();
        d3.selectAll("path").remove();
        d3.selectAll("rect").remove();
        d3.selectAll("circle").remove();
        d3.selectAll("line").remove();
        d3.selectAll('svg > image').remove();
        this.legend.selectAll('.labelBackground').remove()

        const theradius = this.visualSettings.radialSettings.radius

        const arc = d3.arc()
            .startAngle(0)
            .cornerRadius(theradius)

        const arcShadow = d3.arc()
            .startAngle(0)
            .cornerRadius(0)

        const updatearc = (who, type, id, alternativeTotal) => {
            const osnum = type[0];
            const typenum = type[1];
            const display = type[2];
    
            const limit = alternativeTotal ? 100 : this.visualSettings.generalView.totalValueType == "fixed" 
                ? this.visualSettings.generalView.fixedTotal 
                : calculatedTotal;
    
            d3.transition()
                .select(id + osnum + "_" + typenum)
                .transition()
                .duration(id.includes("Shadow") ? 0 : this.visualSettings.animationSettings.enableAnimations 
                    ? osnum * (this.visualSettings.animationSettings.duration * 1000) 
                    : 0)
                .call(arcTween, [type[2] * 1.5 * Math.PI / limit, id == "#monthArcShadow_" ? arcShadow : arc, osnum, typenum, display])
                .on("end", () => {
                    this.events.renderingFinished(options);
                });

        };

        const handleMouseClick = () => {
            this.categorySelected = this.categorySelected == false ? true : false
            this.filteredCategories = []
            this.update(options);
        }


        let uniqueGroup = viewModel.dataPoints.filter(d => d != null).map(d => d.os).filter(this.onlyUnique)

        if(this.sortByValues){
            const sortCategory = []
            try {
                for(let i = 0; i < uniqueGroup.length; i++){
                    sortCategory.push({
                        group: uniqueGroup[i],
                        groupTotal: <number>viewModel.dataPoints.filter(d => d != null).filter(d => d.os == uniqueGroup[i]).map(d => d.value).reduce((a, b) => a + b, 0)
                    })
                }
            } catch (error) {
                console.log(error)
            } 

            sortCategory.sort(function(a, b){ return a.groupTotal < b.groupTotal ? -1 : 1 })
            uniqueGroup = this.sortOrder == 1 ? Array.from(sortCategory, x => x.group).reverse() : Array.from(sortCategory, x => x.group) 
        }
        
        const line_tickness = (Math.min(width, height) / 2 - 20) / uniqueGroup.length

        this.totalByCategory = []
        let biggest = 0
        let maxGroup = null

        for (let index = 0; index < uniqueGroup.length; index++) {

            const indexOnDataview = viewModel.dataPoints.indexOf(viewModel.dataPoints.filter(d => d.os == uniqueGroup[index])[0])
            const currentSum = viewModel.dataPoints.filter(d => d != null).filter(d => d.os == uniqueGroup[index]).map(d => d.value).reduce((a, b) => a + b, 0)
            
            if(currentSum > biggest){
                maxGroup =  uniqueGroup[index]
                biggest = currentSum
            }
            this.totalByCategory.push({
                group: uniqueGroup[index],
                groupTotal: currentSum,
                active: options.dataViews.map(d => d.categorical)[0].categories[0].objects != undefined ? dataViewObjects.dataViewObjects.getValue(options.dataViews.map(d => d.categorical)[0].categories[0].objects[indexOnDataview],
                    { objectName: "generalView", propertyName: "categoryToTotal" }, true) : true,
                identity: viewModel.dataPoints.filter(d => d != null).filter(d => d.os == uniqueGroup[index])[0].identity
            })
        }

        this.totalByCategory.push({
            group: "total",
            groupTotal: this.viewModel.dataPoints.map(d => d.value).reduce((a, b) => a + b, 0),
            active: true,
            identity: null
        })

        
        const total_active_categories = this.totalByCategory.filter(d => d.group != "total").filter(d => d.active).length
        const calculatedTotal = !this.categorySelected && total_active_categories != 0 && this.visualSettings.generalView.totalValueType == "sum" ? this.totalByCategory.filter(d => d.group != "total").filter(d => d.active).map(d => d.groupTotal).reduce((a, b) => a + b, 0) : this.visualSettings.generalView.totalValueType == "fixed" ? this.visualSettings.generalView.fixedTotal : this.totalByCategory.filter(d => d.group == maxGroup)[0].groupTotal

        const labels = []
        const percentageFormat = vL.create({ format: "0.0%" })

        for (let i = 0; i < 7; i++) {
             
            const limit = this.categorySelected && this.existsSecondMeasure ? 100 : this.visualSettings.generalView.totalValueType == "fixed" ? this.visualSettings.generalView.fixedTotal : calculatedTotal
            const quarter = this.categorySelected && this.existsSecondMeasure ? Math.round(limit * (0.1666666 * i)) / 100 : this.cubeFormatIsPercentage ? limit * (0.1666666 * i) : Math.round(limit * (0.1666666 * i))
            let value = ""


            if (this.existsSecondMeasure && this.categorySelected) {
                value = this.formatValue(quarter, this.defaultCubeFormat, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.quarterUnits)
            } else {
                value = this.formatValue(quarter, this.defaultCubeFormat, this.visualSettings.numberLabels.decimalPlaces, this.visualSettings.numberLabels.quarterUnits)
            }
            
            labels.push(value)
        }

        let biggest_number = 0
        for (let i = 0; i < uniqueGroup.length; i++) {
            const number = this.visualSettings.labelValueFormatting.showPercentages == "percentage" ? viewModel.dataPoints.filter(e => e.os == uniqueGroup[i]).map(e => e.value).reduce((a, b) => a + b, 0) / viewModel.total : viewModel.dataPoints.filter(e => e.os == uniqueGroup[i]).map(e => e.value).reduce((a, b) => a + b, 0)

            biggest_number = biggest_number < number ? number : biggest_number
        }

        const wstart = width / 2
        const hstart = (height / 2)
        const radial_height = (Math.min(width, height) / 2 - 20) / uniqueGroup.length


        if (this.visualSettings.labelFormatting.showLabels) {
            try {
                // The following text corresponds to the text of the labels of each bar
                //In this case they appear outside so they are on the top left quarter

                this.circle.selectAll(".labelText")
                    .data(uniqueGroup)
                    .enter()
                    .append("text")
                    .attr("class", "labelText")
                    .attr('x', (d) => {
                        let formattedValue;

                        if (this.categorySelected && this.existsSecondMeasure) {
                            formattedValue = this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.valueSecondMeasure).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.labelUnits)
                        } else { 
                            formattedValue =  this.visualSettings.labelValueFormatting.showPercentages == "percentage" ? percentageFormat.format(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0) / calculatedTotal) : 
                                            this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.labelValueFormatting.decimalPlaces, this.visualSettings.labelValueFormatting.displayUnits)
                        }



                        const separatorLabel = !this.visualSettings.labelValueFormatting.showLabels && !this.visualSettings.labelFormatting.showLabels ? "" : "\u00A0|\u00A0"
                        const valueLabelWidth = this.measureWordWidth(formattedValue, this.visualSettings.labelValueFormatting.size, this.visualSettings.labelValueFormatting.fontFamily, this.visualSettings.labelValueFormatting.textWeight, this.visualSettings.labelValueFormatting.fontItalic)
                        const separatorLabelWidth = this.measureWordWidth(separatorLabel, this.visualSettings.labelSeparator.size, this.visualSettings.labelSeparator.fontFamily, this.visualSettings.labelSeparator.textWeight, this.visualSettings.labelSeparator.fontItalic);



                        if(this.visualSettings.labelValueFormatting.showLabels) {

                            if( this.visualSettings.labelFormatting.labelAlignment == "right") {
                                return wstart
                            } else if( this.visualSettings.labelFormatting.labelAlignment == "left") {
                                return wstart - radial_height * uniqueGroup.length * 0.95 + valueLabelWidth + separatorLabelWidth
                            }
                            else if( this.visualSettings.labelFormatting.labelAlignment == "center") {
                                return wstart - radial_height * uniqueGroup.length * 0.5 + separatorLabelWidth / 2
                            }

                        } else return this.visualSettings.labelFormatting.labelAlignment == "right" ? wstart : 
                                     (this.visualSettings.labelFormatting.labelAlignment == "left" ? wstart - radial_height * uniqueGroup.length * 0.95 : 
                                        this.visualSettings.labelFormatting.labelAlignment == "center" ? wstart - radial_height * uniqueGroup.length * 0.5 : 
                                     "") 


                    })
                    .attr('y', (d, i) => hstart - (radial_height * (i + 1)) + (radial_height * 0.55))
                    .attr("dx", -5)
                    .attr("id", (d, i) => "themark_" + i)
                    .attr("text-anchor", this.visualSettings.labelFormatting.labelAlignment == "center" ? (this.visualSettings.labelValueFormatting.showLabels ? "start" : "middle") : this.visualSettings.labelFormatting.labelAlignment == "left" ? "start" : "end")
                    .attr("font-size", this.visualSettings.labelFormatting.size + 'pt')
                    .attr("font-weight", this.visualSettings.labelFormatting.textWeight ? "bold" : "normal")
                    .attr("text-decoration", this.visualSettings.labelFormatting.fontUnderline ? "underline": "normal")
                    .attr("font-style", this.visualSettings.labelFormatting.fontItalic ? "italic": "normal")
                    .style("font-family", this.visualSettings.labelFormatting.fontFamily)
                    .style("fill", this.visualSettings.labelFormatting.fontColor)
                    .text( (d) => {
                        let formattedValue;

                        if (this.categorySelected && this.existsSecondMeasure) {
                            formattedValue = this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.valueSecondMeasure).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.labelUnits)
                        } else { 
                            formattedValue =  this.visualSettings.labelValueFormatting.showPercentages == "percentage" ? percentageFormat.format(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0) / calculatedTotal) : 
                                            this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.labelValueFormatting.decimalPlaces, this.visualSettings.labelValueFormatting.displayUnits)
                        }


                    
                        const separatorLabel = !this.visualSettings.labelValueFormatting.showLabels && !this.visualSettings.labelFormatting.showLabels ? "" : "\u00A0|\u00A0"
                        const labelWidth = this.measureWordWidth(d, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                        const valueLabelWidth = this.measureWordWidth(formattedValue, this.visualSettings.labelValueFormatting.size, this.visualSettings.labelValueFormatting.fontFamily, this.visualSettings.labelValueFormatting.textWeight, this.visualSettings.labelValueFormatting.fontItalic);
                        const separatorLabelWidth = this.measureWordWidth(separatorLabel, this.visualSettings.labelSeparator.size, this.visualSettings.labelSeparator.fontFamily, this.visualSettings.labelSeparator.textWeight, this.visualSettings.labelSeparator.fontItalic);
                    
                    
                        const completeLabelWidth = this.visualSettings.labelFormatting.showLabels && this.visualSettings.labelValueFormatting.showLabels ?
                                                        valueLabelWidth + separatorLabelWidth + labelWidth :
                                                    this.visualSettings.labelFormatting.showLabels && !this.visualSettings.labelValueFormatting.showLabels ?
                                                        labelWidth :
                                                    !this.visualSettings.labelFormatting.showLabels && this.visualSettings.labelValueFormatting.showLabels ? 
                                                        valueLabelWidth :
                                                        0;
                    
                                                        
                        const availableSpace = this.visualSettings.labelFormatting.labelAlignment == "right" || this.visualSettings.labelFormatting.labelAlignment == "left" ? radial_height * uniqueGroup.length * 0.95 : radial_height * uniqueGroup.length                              
                        
                        
                        const ellipsis = "...";

                        // Truncate text if it exceeds available space
                        if (completeLabelWidth > availableSpace) {
                            let truncatedText = d;
                            let currentWidth = this.measureWordWidth(truncatedText, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                    
                            while (currentWidth > availableSpace && truncatedText.length > 0) {
                                truncatedText = truncatedText.slice(0, -1);  
                                currentWidth = this.measureWordWidth(truncatedText.slice(0, -3) + ellipsis, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                            }
                    
                            return truncatedText.slice(0, -3) + ellipsis; 
                        }
                    
                        return d;
                    })                    
                    .on("click", (d, i) => {
                        // when one category is clicked, the visual moves to another level with the detailed categories
                        if ((this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown) ||
                            (!this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown)) {
                    
                            if (!this.categorySelected) {
                                // If there are no categories selected, the visual appears normal (not filtered)
                                this.selectionManager.clear();
                                const identity = viewModel.dataPoints.filter(d => d.os == <string><unknown>i).map(d => d.identity);
                                return this.selectionManager.select(identity, true).then(() => {
                                    this.selectedCategoryName = <string><unknown>i;
                                    this.selectedCategoryColor = viewModel.dataPoints.filter(d => d.os == <string><unknown>i)[0].color;
                                    this.categorySelected = !this.categorySelected;
                                    this.last_step = "first";
                                    this.update(options);
                                });
                    
                            } else {
                                // In case one category is selected, the visual is filtered by that category 
                                const identity = this.viewModel.dataPoints.filter(d => d.category == i)[0].identity;
                    
                                if (this.identitySelected === identity) { // Click a category that is already selected, reset to default state
                                    this.selectionManager.clear();
                                    this.detailCategorySelected = false;
                                    this.update(options);
                                } else {
                                    this.identitySelected = identity;
                    
                                    // This allows us to track at which level we are
                                    if (this.last_step === "first") {
                                        this.last_step = "second";
                                        this.selectionManager.clear();
                                    }
                    
                                    if (!event["ctrlKey"]) {
                                        this.selectionManager.clear();
                                        this.filteredCategories = [];
                                    }
                    
                                    if (!this.visualSettings.iconHome.allowGoBack_label) {
                                        return this.selectionManager.select(identity, true).then((ids: powerbi.visuals.ISelectionId[]) => {
                                            this.detailCategorySelected = true;
                                            this.filteredCategories.push(viewModel.dataPoints.filter(d => d.category == i)[0].category);
                    
                                            d3.selectAll(".circle_path").style("fill-opacity", 0.2);
                    
                                            for (let i = 0; i < ids.length; i++) {
                                                d3.select("#" + (event.target as HTMLElement).getAttribute("id")).style("fill-opacity", 1);
                                                d3.selectAll("[identifier='" + viewModel.dataPoints.filter(d => d.identity == ids[i])[0].category + "']").style("fill-opacity", 1);
                                            }
                                        });
                                    } else {
                                        this.selectionManager.clear();
                                        return handleMouseClick();
                                    }
                                }
                            }
                        } else {
                            console.log("NO SECOND LEVEL");
                        }
                    });
                    
            } catch (error) {
                console.log(error)
            }
        }



        if (this.visualSettings.labelValueFormatting.showLabels) {
            try {
                // The following text corresponds to the text of the labels of each bar
                //In this case they appear outside so they are on the top left quarter

                this.circle.selectAll(".labelValueText")
                    .data(uniqueGroup)
                    .enter()
                    .append("text")
                    .attr("class", "labelValueText")
                    .attr('x', (d) => {
                        let formattedValue;

                        if (this.categorySelected && this.existsSecondMeasure) {
                            formattedValue = this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.valueSecondMeasure).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.labelUnits)
                        } else { 
                            formattedValue =  this.visualSettings.labelValueFormatting.showPercentages == "percentage" ? percentageFormat.format(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0) / calculatedTotal) : 
                                            this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.labelValueFormatting.decimalPlaces, this.visualSettings.labelValueFormatting.displayUnits)
                        }


                        const separatorLabel = !this.visualSettings.labelValueFormatting.showLabels && !this.visualSettings.labelFormatting.showLabels ? "" : "\u00A0|\u00A0"
                        let labelWidth = this.measureWordWidth(d, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic)
                        const valueLabelWidth = this.measureWordWidth(formattedValue, this.visualSettings.labelValueFormatting.size, this.visualSettings.labelValueFormatting.fontFamily, this.visualSettings.labelValueFormatting.textWeight, this.visualSettings.labelValueFormatting.fontItalic)
                        const separatorLabelWidth = this.measureWordWidth(separatorLabel, this.visualSettings.labelSeparator.size, this.visualSettings.labelSeparator.fontFamily, this.visualSettings.labelSeparator.textWeight, this.visualSettings.labelSeparator.fontItalic);


                        const completeLabelWidth = this.visualSettings.labelFormatting.showLabels && this.visualSettings.labelValueFormatting.showLabels ?
                                                        valueLabelWidth + separatorLabelWidth + labelWidth :
                                                    this.visualSettings.labelFormatting.showLabels && !this.visualSettings.labelValueFormatting.showLabels ?
                                                        labelWidth :
                                                    !this.visualSettings.labelFormatting.showLabels && this.visualSettings.labelValueFormatting.showLabels ? 
                                                        valueLabelWidth :
                                                        0;

                                                        
                        const availableSpace = this.visualSettings.labelFormatting.labelAlignment == "right" || this.visualSettings.labelFormatting.labelAlignment == "left" ? radial_height * uniqueGroup.length * 0.95 : radial_height * uniqueGroup.length                              


                        const ellipsis = "...";
       
                        // Truncate text if it exceeds available space
                        if (completeLabelWidth > availableSpace) {
                            let truncatedText = d;
                            let currentWidth = this.measureWordWidth(truncatedText, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);

                            while (currentWidth> availableSpace && truncatedText.length > 0) {
                                truncatedText = truncatedText.slice(0, -1);  
                                currentWidth = this.measureWordWidth(truncatedText.slice(0, -3) + ellipsis, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                            }

                            labelWidth = this.measureWordWidth(truncatedText.slice(0, -3) + ellipsis, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                        }

                        if(this.visualSettings.labelFormatting.showLabels) {
                            if( this.visualSettings.labelFormatting.labelAlignment == "right") {
                                return wstart - labelWidth - separatorLabelWidth
                            } else if( this.visualSettings.labelFormatting.labelAlignment == "left") {
                                return wstart - radial_height * uniqueGroup.length * 0.95
                            } else if( this.visualSettings.labelFormatting.labelAlignment == "center") {
                                return wstart - radial_height * uniqueGroup.length * 0.5 - separatorLabelWidth / 2
                            }
                        } else return this.visualSettings.labelFormatting.labelAlignment == "right" ? wstart : 
                                      this.visualSettings.labelFormatting.labelAlignment == "left" ? wstart - radial_height * uniqueGroup.length * 0.95 :
                                      this.visualSettings.labelFormatting.labelAlignment == "center" ? wstart - radial_height * uniqueGroup.length * 0.5 : ""
 
                    })
                    .attr('y', function (d, i) {
                        return hstart - (radial_height * (i + 1)) + (radial_height * 0.55)
                    })
                    .attr("dx", -5)
                    .attr("id", (d, i) => "themark_" + i)
                    .attr("text-anchor", this.visualSettings.labelFormatting.labelAlignment == "center" ? (this.visualSettings.labelFormatting.showLabels ? "end" : "middle") : this.visualSettings.labelFormatting.labelAlignment == "left" ? "start" : "end")
                    .attr("font-size", this.visualSettings.labelValueFormatting.size + 'pt')
                    .attr("font-weight", this.visualSettings.labelValueFormatting.textWeight ? "bold" : "normal")
                    .attr("text-decoration", this.visualSettings.labelValueFormatting.fontUnderline ? "underline": "normal")
                    .attr("font-style", this.visualSettings.labelValueFormatting.fontItalic ? "italic": "normal")
                    .style("font-family", this.visualSettings.labelValueFormatting.fontFamily)
                    .style("fill", this.visualSettings.labelValueFormatting.fontColor)
                    .text((d) => {

                        let formattedValue;

                        if (this.categorySelected && this.existsSecondMeasure) {
                            formattedValue = this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.valueSecondMeasure).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.labelUnits)
                        } else { 
                            formattedValue =  this.visualSettings.labelValueFormatting.showPercentages == "percentage" ? percentageFormat.format(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0) / calculatedTotal) : 
                                            this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.labelValueFormatting.decimalPlaces, this.visualSettings.labelValueFormatting.displayUnits)
                        }

                        return formattedValue
                        

                    })
                    .on("click", (d, i) => {

                        // when one category is clicked, the visual moves to another level with the detailed categories
                        if((this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown) || (!this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown)){
                            
                            if (!this.categorySelected) {

                                // if there are no category selected, the visual appears normal, i.e., not filtered
                               
                                this.selectionManager.clear()
                                const identity = viewModel.dataPoints.filter(d => d.os == <string><unknown>i).map(d => d.identity)

                                return this.selectionManager.select(identity, true).then(() => {
                                    this.selectedCategoryName = <string><unknown>i
                                    this.selectedCategoryColor = viewModel.dataPoints.filter(d => d.os == <string><unknown>i)[0].color
                                    this.categorySelected = this.categorySelected == false ? true : false
                                    this.last_step = "first"
                                    this.update(options);
                                });

                            } else {

                                // In case one category is selected, the visual is filtered by that category 

                                const identity = this.viewModel.dataPoints.filter(d => d.category == i)[0].identity

                                if(this.identitySelected == identity){ // Click a category that is already selected, reset to default state
                                    this.selectionManager.clear()
                                    this.detailCategorySelected = false
                                    this.update(options);
                                } else{
                                    this.identitySelected = identity
                                    
                                    // this allow us to know at which level are we in
                                    if (this.last_step == "first") {
                                        this.last_step = "second"
                                        this.selectionManager.clear()
                                    }
    
                                    if (!event["ctrlKey"]) {
                                        this.selectionManager.clear()
                                        this.filteredCategories = []
                                    }

    
                                    if(!this.visualSettings.iconHome.allowGoBack_label){
                                        return this.selectionManager.select(identity, true).then((ids: powerbi.visuals.ISelectionId[]) => {

                                            this.detailCategorySelected = true

                                            this.filteredCategories.push(viewModel.dataPoints.filter(d => d.category == i)[0].category)
        
                                            d3.selectAll(".circle_path").style("fill-opacity", 0.2)
        
        
                                            for (let i = 0; i < ids.length; i++) {
        
                                                d3.select("#" + (event.target as HTMLElement).getAttribute("id")).style("fill-opacity", 1);
                                                d3.selectAll("[identifier='" + viewModel.dataPoints.filter(d => d.identity == ids[i])[0].category + "']").style("fill-opacity", 1)
                                            }
        
                                        });                                             
                                    }
                                    else {
                                        this.selectionManager.clear()
                                        return handleMouseClick();                                        
                                    }                               
                                }



                            }
                        } else{
                            console.log("NO SECOND LEVEL")
                        }

                    })
            } catch (error) {
                console.log(error)
            }
        }


        if (this.visualSettings.labelValueFormatting.showLabels && this.visualSettings.labelFormatting.showLabels) {
            try {
                // The following text corresponds to the text of the labels of each bar
                //In this case they appear outside so they are on the top left quarter

                this.circle.selectAll(".labelSeparatorText")
                    .data(uniqueGroup)
                    .enter()
                    .append("text")
                    .attr("class", "labelSeparatorText")
                    .attr('x', (d) => {
                        let formattedValue;

                        if (this.categorySelected && this.existsSecondMeasure) {
                            formattedValue = this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.valueSecondMeasure).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.labelUnits)
                        } else { 
                            formattedValue =  this.visualSettings.labelValueFormatting.showPercentages == "percentage" ? percentageFormat.format(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0) / calculatedTotal) : 
                                            this.formatValue(viewModel.dataPoints.filter(e => e.os == d).map(e => e.value).reduce((a, b) => a + b, 0), this.defaultCubeFormat, this.visualSettings.labelValueFormatting.decimalPlaces, this.visualSettings.labelValueFormatting.displayUnits)
                        }


                        const separatorLabel = !this.visualSettings.labelValueFormatting.showLabels && !this.visualSettings.labelFormatting.showLabels ? "" : "\u00A0|\u00A0"
                        let labelWidth = this.measureWordWidth(d, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                        const valueLabelWidth = this.measureWordWidth(formattedValue, this.visualSettings.labelValueFormatting.size, this.visualSettings.labelValueFormatting.fontFamily, this.visualSettings.labelValueFormatting.textWeight, this.visualSettings.labelValueFormatting.fontItalic);
                        const separatorLabelWidth = this.measureWordWidth(separatorLabel, this.visualSettings.labelSeparator.size, this.visualSettings.labelSeparator.fontFamily, this.visualSettings.labelSeparator.textWeight, this.visualSettings.labelSeparator.fontItalic);
                    
                    
                        const completeLabelWidth = this.visualSettings.labelFormatting.showLabels && this.visualSettings.labelValueFormatting.showLabels ?
                                                        valueLabelWidth + separatorLabelWidth + labelWidth :
                                                    this.visualSettings.labelFormatting.showLabels && !this.visualSettings.labelValueFormatting.showLabels ?
                                                        labelWidth :
                                                    !this.visualSettings.labelFormatting.showLabels && this.visualSettings.labelValueFormatting.showLabels ? 
                                                        valueLabelWidth :
                                                        0;
                    
                                                        
                        const availableSpace = this.visualSettings.labelFormatting.labelAlignment == "right" || this.visualSettings.labelFormatting.labelAlignment == "left" ? radial_height * uniqueGroup.length * 0.95 : radial_height * uniqueGroup.length                              
                        
                        
                        const ellipsis = "...";

                        // Truncate text if it exceeds available space
                        if (completeLabelWidth > availableSpace) {
                            let truncatedText = d;
                            let currentWidth = this.measureWordWidth(truncatedText, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                    
                            while (currentWidth > availableSpace && truncatedText.length > 0) {
                                truncatedText = truncatedText.slice(0, -1);  
                                currentWidth = this.measureWordWidth(truncatedText.slice(0, -3) + ellipsis, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                            }
                    
                            labelWidth = this.measureWordWidth(truncatedText.slice(0, -3) + ellipsis, this.visualSettings.labelFormatting.size, this.visualSettings.labelFormatting.fontFamily, this.visualSettings.labelFormatting.textWeight, this.visualSettings.labelFormatting.fontItalic);
                        }


                        if( this.visualSettings.labelFormatting.labelAlignment == "right") {
                            return wstart - labelWidth
                        } else if( this.visualSettings.labelFormatting.labelAlignment == "left") {
                            return wstart - radial_height * uniqueGroup.length * 0.95 + valueLabelWidth
                        }
                        else if( this.visualSettings.labelFormatting.labelAlignment == "center") {
                            return wstart - radial_height * uniqueGroup.length * 0.5
                        }


                    })
                    .attr('y', function (d, i) {
                        return hstart - (radial_height * (i + 1)) + (radial_height * 0.55)
                    })
                    .attr("dx", -5)
                    .attr("id", (d, i) => "themark_" + i)
                    .attr("text-anchor", this.visualSettings.labelFormatting.labelAlignment == "center" ? "middle" : this.visualSettings.labelFormatting.labelAlignment == "left" ? "start" : "end")
                    .attr("font-size", this.visualSettings.labelSeparator.size + 'pt')
                    .attr("font-weight", this.visualSettings.labelSeparator.textWeight ? "bold" : "normal")
                    .attr("text-decoration", this.visualSettings.labelSeparator.fontUnderline ? "underline": "normal")
                    .attr("font-style", this.visualSettings.labelSeparator.fontItalic ? "italic": "normal")
                    .style("font-family", this.visualSettings.labelSeparator.fontFamily)
                    .style("fill", this.visualSettings.labelSeparator.fontColor)
                    .text("\u00A0|\u00A0")
                    .on("click", (d, i) => {

                        // when one category is clicked, the visual moves to another level with the detailed categories
                        if((this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown) || (!this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown)){
                            
                            if (!this.categorySelected) {

                                // if there are no category selected, the visual appears normal, i.e., not filtered
                               
                                this.selectionManager.clear()
                                const identity = viewModel.dataPoints.filter(d => d.os == <string><unknown>i).map(d => d.identity)
                                return this.selectionManager.select(identity, true).then(() => {
                                    this.selectedCategoryName = <string><unknown>i
                                    this.selectedCategoryColor = viewModel.dataPoints.filter(d => d.os == <string><unknown>i)[0].color
                                    this.categorySelected = this.categorySelected == false ? true : false
                                    this.last_step = "first"
                                    this.update(options);
                                });

                            } else {

                                // In case one category is selected, the visual is filtered by that category 

                                const identity = this.viewModel.dataPoints.filter(d => d.category == i)[0].identity

                                if(this.identitySelected == identity){ // Click a category that is already selected, reset to default state
                                    this.selectionManager.clear()
                                    this.detailCategorySelected = false
                                    this.update(options);
                                } else{
                                    this.identitySelected = identity
                                    
                                    // this allow us to know at which level are we in
                                    if (this.last_step == "first") {
                                        this.last_step = "second"
                                        this.selectionManager.clear()
                                    }
    
                                    if (!event["ctrlKey"]) {
                                        this.selectionManager.clear()
                                        this.filteredCategories = []
                                    }

    
                                    if(!this.visualSettings.iconHome.allowGoBack_label){
                                        return this.selectionManager.select(identity, true).then((ids: powerbi.visuals.ISelectionId[]) => {

                                            this.detailCategorySelected = true

                                            this.filteredCategories.push(viewModel.dataPoints.filter(d => d.category == i)[0].category)
        
                                            d3.selectAll(".circle_path").style("fill-opacity", 0.2)
        
        
                                            for (let i = 0; i < ids.length; i++) {        
                                                d3.select("#" + (event.target as HTMLElement).getAttribute("id")).style("fill-opacity", 1);
                                                d3.selectAll("[identifier='" + viewModel.dataPoints.filter(d => d.identity == ids[i])[0].category + "']").style("fill-opacity", 1)
                                            }
        
                                        });                                             
                                    }
                                    else {
                                        this.selectionManager.clear()
                                        return handleMouseClick();                                        
                                    }                               
                                }



                            }
                        } else{
                            console.log("NO SECOND LEVEL")
                        }

                    })
            } catch (error) {
                console.log(error)
            }
        }



        let color_index = this.visualSettings.radialSettings.startingOpacity/100



        for (let groupIndex = 0; groupIndex <= uniqueGroup.length - 1; groupIndex++) {
            const dataview_category_values = this.existsSecondMeasure && this.categorySelected ? viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex]).map(d => d.valueSecondMeasure) : viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex]).map(d => d.accu)
            const uniqueCategories = viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex]).map(d => d.category).filter(this.onlyUnique)

            const is_category_over_limit = this.totalByCategory.filter(d => d.group == uniqueGroup[groupIndex])[0].groupTotal > calculatedTotal
            const category_limit = is_category_over_limit ? calculatedTotal : this.totalByCategory.filter(d => d.group == uniqueGroup[groupIndex])[0].groupTotal
            let calculated_category_values = []
            if (is_category_over_limit) {
                for (const value of dataview_category_values) {
                    calculated_category_values.push((value * category_limit) / this.totalByCategory.filter(d => d.group == uniqueGroup[groupIndex])[0].groupTotal)
                }
            } else {
                calculated_category_values = dataview_category_values
            }

            d3.select("#demo10")
                .append("g")
                .attr("transform", "translate(500,500)");
            
            if (this.visualSettings.radialSettings.shadowVisible == "shadow") {

                // creates background behind the radial bars
                this.background.append("path")
                    .datum({ startAngle: 0, endAngle: 0.001, innerRadius: (0.1 * line_tickness) + (line_tickness * groupIndex), outerRadius: line_tickness * (groupIndex + 1), identity: viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].identity })
                    .attr('d', arcShadow)
                    .attr("class", "shadow_circle_path")
                    .style("fill", this.visualSettings.radialSettings.shadowColor)
                    .style("fill-opacity", this.visualSettings.radialSettings.shadowOpacity/100)
                    .attr("id", "monthArcShadow_" + groupIndex + "_" + groupIndex)
                    .attr('transform', 'translate(' + wstart + ',' + (hstart) + ')')                    
                    .style('stroke-linejoin', 'round')
                    .call(updatearc, [groupIndex, groupIndex, calculatedTotal, (calculatedTotal / category_limit)], "#monthArcShadow_", false)
                    

            } else {
                // creates sonar lines
                this.background.append("path")
                    .attr("d", d3.arc()
                        .innerRadius((0.5 * line_tickness) + (line_tickness * groupIndex))
                        .outerRadius((0.55 * line_tickness) + (line_tickness * (groupIndex)))
                        .startAngle(-6.28)     // It's in radian, so Pi = 3.14 = bottom.
                        .endAngle(-1.57)       // 2*Pi = 6.28 = top
                    )
                    .attr('fill', this.visualSettings.referenceLine.sonarLinesColor)
                    .attr("transform", 'translate(' + wstart + ',' + (hstart) + ')')
                    .attr("fill-opacity", this.visualSettings.referenceLine.sonarOpacity/100)

            }




            if (this.visualSettings.referenceLine.showReferenceLines) {
                    
                // creates last reference line
                this.background.append("line")
                    .attr("x1", wstart)
                    .attr("y1", hstart)
                    .attr("x2", wstart - (line_tickness * (uniqueGroup.length) * 1.05))
                    .attr("y2", hstart)
                    .attr("stroke-opacity", this.visualSettings.referenceLine.sonarOpacity/100)
                    .attr("stroke-dasharray", this.visualSettings.referenceLine.dashline)
                    .attr("stroke", this.visualSettings.referenceLine.sonarLinesColor)
                    .attr("stroke-width", this.visualSettings.referenceLine.sonarLineWidth)



                for (let i = -2; i < 4; i++) {

                    // creates reference lines
                    this.background.append("line")
                        .attr("id", "shadowLine" + i)
                        .attr("x1", wstart)
                        .attr("y1", hstart)
                        .attr("x2", calculateRadialPoints(i, 10)[0])
                        .attr("y2", calculateRadialPoints(i, 10)[1])
                        .attr("stroke-opacity", this.visualSettings.referenceLine.sonarOpacity/100)
                        .attr("stroke-dasharray", this.visualSettings.referenceLine.dashline)
                        .attr("stroke", this.visualSettings.referenceLine.sonarLinesColor)
                        .attr("stroke-width", this.visualSettings.referenceLine.sonarLineWidth)
                }
            }

            
            
            color_index = !this.categorySelected ? this.visualSettings.radialSettings.startingOpacity/100 : color_index + this.visualSettings.radialSettings.opacitySteps/100

            for (let category_index = calculated_category_values.length - 1; category_index >= 0; category_index--) {

                
                if (dataview_category_values[category_index] != 0.001) {
                    
                    // creates the radial bars
                    this.circle
                        .append("path")
                        .datum({ startAngle: 0, 
                                    endAngle: 0.001, 
                                    innerRadius: (0.1 * line_tickness) + (line_tickness * groupIndex), 
                                    outerRadius: line_tickness * (groupIndex + 1), 
                                    identity: this.viewModel.dataPoints.filter(d => d.category == uniqueCategories[category_index])[0].identity, 
                                    category: this.categorySelected ? uniqueCategories[category_index] : uniqueGroup[groupIndex], 
                                    group: this.viewModel.dataPoints.filter(d => d.category == uniqueCategories[category_index])[0].category,
                                    value: viewModel.dataPoints.filter(d => d.os == (this.categorySelected ? uniqueCategories[category_index] : 
                                    uniqueGroup[groupIndex])).filter(d => d.category == uniqueCategories[category_index])[0].value })
                        .attr('d', arc)
                        .attr("class", "circle_path")
                        .attr("identifier", this.categorySelected ? uniqueCategories[category_index] : uniqueGroup[groupIndex])
                        .style("stroke", "none")
                        .style('stroke-linejoin', 'round')
                        .style("stroke-width", 0)
                        .style("fill", this.visualSettings.radialSettings.colorScheme == "hexaColor" ? this.categorySelected ? this.selectedCategoryColor : viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].color : this.categorySelected ? getColor(this.selectedCategoryColor, color_index) : getColor(viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].color, color_index))
                        .style("fill-opacity", this.visualSettings.radialSettings.colorScheme == "hexaColor" ? color_index : 1)
                        .attr("id", "monthArc_" + groupIndex + "_" + category_index)
                        .attr('transform', 'translate(' + (wstart) + ',' + (hstart) + ')')
                        .call(updatearc, [groupIndex, category_index, this.existsSecondMeasure && this.categorySelected ? calculated_category_values[category_index] * 100 : calculated_category_values[category_index], this.existsSecondMeasure && this.categorySelected ? 100 : (calculated_category_values[category_index] / category_limit)], "#monthArc_", this.existsSecondMeasure && this.categorySelected ? true : false)
                        .on("click", () => {

                            // the behaviour when clicking the bars, is the same as clicking the labels
                            // when one bar is clicked, the visual moves to another level with the detailed categories

                            if((this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown) || (!this.existsSecondMeasure && this.visualSettings.radialSettings.activateDrilldown)){
                               
                                if (!this.categorySelected) { // if there are no category selected, the visual appears normal, i.e., not filtered
                                    
                                    this.selectionManager.clear()
                                    const identity = viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex]).map(d => d.identity)

                                    return this.selectionManager.select(identity, true).then(() => {
                                        this.selectedCategoryName = uniqueGroup[groupIndex]
                                        this.selectedCategoryColor = viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].color
                                        this.categorySelected = this.categorySelected == false ? true : false
                                        this.last_step = "first"
                                        this.update(options);
                                    });
    
                                } else {

                                    // In case one category is selected, the visual is filtered by that category 

                                    const identity = this.viewModel.dataPoints.filter(d => d.category == uniqueCategories[category_index])[0].identity

                                    if(this.identitySelected == identity){ // Click a category that is already selected, reset to default state
                                        this.selectionManager.clear()
                                        this.detailCategorySelected = false
                                        this.update(options);
                                    } else{
                                        this.identitySelected = identity
                                    
                                        if (this.last_step == "first") { // this allow us to know at which level are we in
                                            this.last_step = "second"
                                            this.selectionManager.clear()
                                        }
    

                                        if (!(event["ctrlKey"] || event["shiftKey"] || event["altKey"])) {
                                            this.selectionManager.clear()
                                            this.filteredCategories = []
                                        } 




                                        // if allow go back when clicking a category, the visual comes back to the first level, and it is not filtered
                                        if(!this.visualSettings.iconHome.allowGoBack_category) {
                                            return this.selectionManager.select(identity, true).then((ids: powerbi.visuals.ISelectionId[]) => {

                                                this.detailCategorySelected = true

                                                this.filteredCategories.push(viewModel.dataPoints.filter(d => d.category == uniqueCategories[category_index])[0].category)
            
                                                d3.selectAll(".circle_path").style("fill-opacity", 0.2)
            
                                                for (let i = 0; i < ids.length; i++) {
            
                                                    d3.select("#" + (event.target as HTMLElement).getAttribute("id")).style("fill-opacity", 1);
                                                    d3.selectAll("[identifier='" + viewModel.dataPoints.filter(d => d.identity == ids[i])[0].category + "']").style("fill-opacity", 1)
                                                }
            
                                            });
                                        }
                                        else {
                                            this.selectionManager.clear()
                                            return handleMouseClick();
                                        }
                                    }
                                }
                            } else{
                                console.log("NO SECOND LEVEL")
                            }
                        })

                    this.tooltipServiceWrapper.addTooltip(this.svg.selectAll(".circle_path"),
                        (tooltipEvent: TooltipEventArgs<DataPoint>) => this.getTooltipData(tooltipEvent),
                        (tooltipEvent: TooltipEventArgs<DataPoint>) => this.getTooltipIdentity(tooltipEvent)
                    );
                }

                color_index = !this.categorySelected ? color_index + (viewModel.dataPoints.filter(d => d.os == (this.categorySelected ? uniqueCategories[category_index] : uniqueGroup[groupIndex])).filter(d => d.category == uniqueCategories[category_index])[0].value == 0 ? 0 : this.visualSettings.radialSettings.opacitySteps/100) : color_index + 0
            }

            if (this.visualSettings.targetSettings.showTarget && (this.visualSettings.targetSettings.targetType == "variable")) {  

                // creates a line that shows where the target is
                this.circle.append("line")
                    .attr("id", "targetLine" + groupIndex)
                    .attr("x1", calculateTargetPositions(groupIndex, this.existTargetMetric ? viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].target : this.visualSettings.targetSettings.fixedTarget)[0])
                    .attr("y1", calculateTargetPositions(groupIndex, this.existTargetMetric ? viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].target : this.visualSettings.targetSettings.fixedTarget)[1])
                    .attr("x2", calculateTargetPositions(groupIndex, this.existTargetMetric ? viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].target : this.visualSettings.targetSettings.fixedTarget)[2])
                    .attr("y2", calculateTargetPositions(groupIndex, this.existTargetMetric ? viewModel.dataPoints.filter(d => d.os == uniqueGroup[groupIndex])[0].target : this.visualSettings.targetSettings.fixedTarget)[3])
                    .attr("stroke-opacity", this.visualSettings.targetSettings.targetLineOpacity/100)
                    .attr("stroke-dasharray", 0)
                    .style("z-index", 9999)
                    .attr("stroke", this.visualSettings.targetSettings.targetLineColor)
                    .attr("stroke-width", this.visualSettings.targetSettings.targetLineWidth)
                    .attr("display", this.categorySelected ? "none" : "block")
            }


            if (this.visualSettings.radialSettings.shadowVisible == "shadow" && this.visualSettings.lineSettings.lineVisible) {

                // creates a circle that borders the radial chart
                this.background.append("path")
                    .attr("transform", 'translate(' + wstart + ',' + (hstart) + ')')
                    .attr("d", d3.arc()
                        .innerRadius(1 + (line_tickness * (uniqueGroup.length)))
                        .outerRadius(line_tickness * (uniqueGroup.length))
                        .startAngle(-6.28)     // It's in radian, so Pi = 3.14 = bottom.
                        .endAngle(-1.57)       // 2*Pi = 6.28 = top
                    )
                    .attr('stroke', this.visualSettings.lineSettings.linecolor)
                    .attr('fill', this.visualSettings.lineSettings.linecolor)
                    .attr("stroke-width", this.visualSettings.lineSettings.linethickness)

            }
        }

        if (this.categorySelected) {

            // when we are on the second level, we want to click on the blank space on the left and on the right 
            // then two transparent clickable areas were created (one on the left and another on the right) so that is possible
            
            // Creates clickable area as a rectangle
            this.svg.append("rect")
                .attr("class", "buttonArea")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", (calculateRadialPoints(4, 5)[0] + (-5)) - 25) //switched i for 6 (last label)
                .attr("height", height)
                .attr("fill", "transparent")
                .attr("opacity", 0)
                .on("click", () => {
                    
                    if(!this.visualSettings.iconHome.allowGoBack_blank_space){
                        if(this.detailCategorySelected){      // if there is a category selected, it deselects it
                            this.selectionManager.clear()
                            this.detailCategorySelected = false
                            this.update(options);
                        }
                    }
                    else {
                        this.selectionManager.clear();
                        return handleMouseClick(); 
                    }
                });

            this.svg.append("rect")
                .attr("class", "buttonArea")
                .attr("x", calculateRadialPoints(0, 5)[0] + (-5) + 27) //switched i for 2 (third label))
                .attr("y", 0)
                .attr("width", (calculateRadialPoints(4, 5)[0] + (-5)))
                .attr("height", height)
                .attr("fill", "transparent")
                .attr("opacity", 0)
                .on("click", () => {
                    if(!this.visualSettings.iconHome.allowGoBack_blank_space){
                        if(this.detailCategorySelected){      // if there is a category selected, it deselects it
                            this.selectionManager.clear()
                            this.detailCategorySelected = false
                            this.update(options);
                        }
                    }
                    else {
                        this.selectionManager.clear();
                        return handleMouseClick(); 
                    }
                });
                    
            // Create the go back icon using the base64 data URL
            this.svg.append("svg:image")
                .attr("class", "icons")
                .attr("xlink:href", this.visualSettings.iconHome.defaultIcon)
                .attr("x", width * (this.visualSettings.iconHome.x_position / 100))
                .attr("y", height * (this.visualSettings.iconHome.y_position / 100))
                .attr("width", this.visualSettings.iconHome.size + "px")
                .attr("height", this.visualSettings.iconHome.size + "px")
                .attr("transform", "rotate(90 " + (width * (this.visualSettings.iconHome.x_position / 100) + this.visualSettings.iconHome.size / 2) + " " + (height * (this.visualSettings.iconHome.y_position / 100) + this.visualSettings.iconHome.size / 2) + ")")
                .on("click", () => {
                    this.selectionManager.clear();
                    return handleMouseClick();
                });   
                        
                    
            // Adds label under the icon indicating the category we are in
            if(this.visualSettings.iconHome.show_label){
                
                this.svg.append("text")
                    .attr("class", "iconText")
                    .attr('x', width * (this.visualSettings.iconHome.x_position / 100) + this.visualSettings.iconHome.size / 2)
                    .attr('y', height * (this.visualSettings.iconHome.y_position / 100) + this.visualSettings.iconHome.size + 0.5 * this.visualSettings.iconHome.size)
                    .attr("text-anchor", "middle")
                    .attr("font-size", this.visualSettings.iconHome.label_size + 'pt')
                    .attr("font-weight", this.visualSettings.iconHome.textWeight ? "bold" : "normal")
                    .attr("text-decoration", this.visualSettings.iconHome.fontUnderline ? "underline": "normal")
                    .attr("font-style", this.visualSettings.iconHome.fontItalic ? "italic": "normal")
                    .style("font-family", this.visualSettings.iconHome.fontFamily)
                    .attr("fill", this.visualSettings.iconHome.fontColor)
                    .text(this.selectedCategoryName)
                    .on("click", () => {
                        this.selectionManager.clear();
                        return handleMouseClick();
                    }); 
            }

        }



        if (this.visualSettings.numberLabels.showNumbers) {

            // Adds the value to each category label

            this.circle.selectAll(".label_numbers")
                .data(labels)
                .enter()
                .append('text')
                .attr("class", "label_numbers")
                .attr("x", (d, i) => calculateRadialPoints(i - 2, 5)[0] + (i <= 3 ? i == 3 ? (+10) : (+5) : (-5)))
                .attr("y", (d, i) => calculateRadialPoints(i - 2, 5)[1] + (i <= 3 ? (-5) : (+15)))
                .style("z-index", "999999")
                .attr("font-size", this.visualSettings.numberLabels.size + 'pt')
                .attr("font-weight", this.visualSettings.numberLabels.textWeight ? "bold" : "normal")
                .attr("text-decoration", this.visualSettings.numberLabels.fontUnderline ? "underline": "normal")
                .attr("font-style", this.visualSettings.numberLabels.fontItalic ? "italic": "normal")
                .style("font-family", this.visualSettings.numberLabels.fontFamily)
                .style("fill", this.visualSettings.numberLabels.fontColor)
                .style("text-anchor", (d, i) => i <= 3 ? "start" : "end")
                .text(function (d) {
                    return d
                });
        }



        if (this.visualSettings.targetSettings.showTarget && (this.visualSettings.targetSettings.targetType == "fixed")) {

            // creates target line
            this.circle.append("line")
                .attr("id", "targetLine")
                .attr("x1", wstart)
                .attr("y1", hstart)
                .attr("x2", calculateTargetPositions(uniqueGroup.length - 1, (this.existTargetMetric ? this.targetValue : this.visualSettings.targetSettings.fixedTarget))[2])
                .attr("y2", calculateTargetPositions(uniqueGroup.length - 1, (this.existTargetMetric ? this.targetValue : this.visualSettings.targetSettings.fixedTarget))[3])
                .attr("stroke-opacity", this.visualSettings.targetSettings.targetLineOpacity/100)
                .attr("stroke-dasharray", 0)
                .style("z-index", 99999)
                .attr("stroke", this.visualSettings.targetSettings.targetLineColor)
                .attr("stroke-width", this.visualSettings.targetSettings.targetLineWidth)
                .attr("display", this.categorySelected ? "none" : "block")
            




            // Adds a label to the target line with the target value
            const targetLineLabel = this.background
                .append("text")
                .attr("id", "targetLineLabel")
                .attr("x", () => {
                    const textProperties = {
                        text: this.visualSettings.targetTitle.title,
                        fontFamily: this.visualSettings.targetTitle.fontFamily,
                        fontSize: this.visualSettings.targetTitle.fontSize + "pt",
                        fontStyle: this.visualSettings.targetTitle.textWeight ? "bold" : "normal"
                    };

                    const labelWidth = textMeasurementService.measureSvgTextWidth(textProperties);
                    const xPosition = calculateTargetPositions(uniqueGroup.length - 1, this.existTargetMetric ? this.targetValue : this.visualSettings.targetSettings.fixedTarget)[2];

                    return xPosition + (xPosition > (width * 0.5) ? (labelWidth * 0.1) : -(labelWidth * 0.1));
                })
                .attr("y", () => {
                    const textProperties = {
                        text: this.visualSettings.targetTitle.title,
                        fontFamily: this.visualSettings.targetTitle.fontFamily,
                        fontSize: this.visualSettings.targetTitle.fontSize + "pt",
                        fontWeight: this.visualSettings.targetTitle.textWeight ? "bold" : "normal"
                    };

                    const labelHeight = textMeasurementService.measureSvgTextHeight(textProperties);
                    const yPosition = calculateTargetPositions(uniqueGroup.length - 1, this.existTargetMetric ? this.targetValue : this.visualSettings.targetSettings.fixedTarget)[3];

                    return yPosition + (yPosition > (height * 0.5) ? labelHeight : 0);
                })
                .attr("fill", this.visualSettings.targetTitle.fontColor)
                .attr("text-anchor", () => {
                    const xPosition = calculateTargetPositions(uniqueGroup.length - 1, this.existTargetMetric ? this.targetValue : this.visualSettings.targetSettings.fixedTarget)[2];
                    return xPosition > (width * 0.5) ? "start" : "end";
                })
                .attr("display", this.categorySelected ? "none" : "block")

            // Append Title as a separate <tspan>
            targetLineLabel.append("tspan")
                .attr("fill", this.visualSettings.targetTitle.fontColor)  // Allow different color for title
                .attr("font-size", this.visualSettings.targetTitle.fontSize + 'pt')  // Separate font size for title
                .attr("font-weight", this.visualSettings.targetTitle.textWeight ? "bold" : "normal")  // Apply bold or normal
                .attr("text-decoration", this.visualSettings.targetTitle.fontUnderline ? "underline" : "none")  // Apply underline if enabled
                .attr("font-style", this.visualSettings.targetTitle.fontItalic ? "italic" : "normal")  // Apply italic if enabled
                .style("font-family", this.visualSettings.targetTitle.fontFamily)  // Separate font family for title
                .text(this.visualSettings.targetTitle.title);

            // Append Value as a separate <tspan>  
            targetLineLabel.append("tspan")
                .attr("dx", 5)  // Add spacing between title and value
                .attr("fill", this.visualSettings.targetSettings.fontColor)  // Allow different color for value
                .attr("font-size", this.visualSettings.targetSettings.fontSize + 'pt')  // Separate font size for value
                .attr("font-weight", this.visualSettings.targetSettings.textWeight ? "bold" : "normal")  // Apply bold or normal
                .attr("text-decoration", this.visualSettings.targetSettings.fontUnderline ? "underline" : "none")  // Apply underline if enabled
                .attr("font-style", this.visualSettings.targetSettings.fontItalic ? "italic" : "normal")  // Apply italic if enabled
                .style("font-family", this.visualSettings.targetSettings.fontFamily)  // Separate font family for value
                .text(this.formatValue((this.existTargetMetric ? this.targetValue : this.visualSettings.targetSettings.fixedTarget), this.defaultCubeFormat, this.visualSettings.targetSettings.decimalPlaces, this.visualSettings.targetSettings.quarterUnits));

                    



        }

        //handle context menu
        this.svg.on('contextmenu', (event: MouseEvent) => { 
            const eventTarget = event.target as SVGElement; // Use a more specific type
            const dataPoint = d3.select<SVGElement, datum>(eventTarget).datum();
            
            this.selectionManager.showContextMenu(dataPoint ? dataPoint.identity : {}, {
                x: event.clientX,
                y: event.clientY
            });
        
            event.preventDefault();
        });
        





        /**
         * Function Name: calculateRadialPoints
         * Description: Calculates the coordinates of a point on a radial line at a given position.
         *
         * @param {number} position - The position of the point on the radial line.
         * @param {number} outMargin - The margin outside the radial line.
         * @returns {number[]} - An array containing the x and y coordinates of the calculated point.
         */

        function calculateRadialPoints(position, outMargin) {
            const cx = wstart
            const cy = hstart
            const r = line_tickness * (uniqueGroup.length) + outMargin //--radius--
            const angle = Math.PI * 0.25 //---angle between each line---

            const x2 = r * Math.cos(angle * position) + cx
            const y2 = r * Math.sin(angle * position) + cy
            
            return [x2, y2]
        }
        

        /**
         * Function Name: calculateTargetPositions
         * Description: Calculates the coordinates of two points for a target line based on position and target values.
         *
         * @param {number} position - The position of the target line.
         * @param {number} target - The target value.
         * @returns {number[]} - An array containing the x and y coordinates of the starting and ending points of the target line.
         */
        function calculateTargetPositions(position, target) {
            const degree =  270 - ((270 * ((target / calculatedTotal) * 100)) / 100)
            const r2 = line_tickness * (position + 1)
            const r1 = line_tickness * (position) + (line_tickness * 0.1)//--radius--

            const rad = (270 + degree) * Math.PI / 180;
            const x1 = wstart + Math.sin(rad) * r1
            const y1 = hstart + Math.cos(rad) * r1;
            const x2 = wstart + Math.sin(rad) * r2;
            const y2 = hstart + Math.cos(rad) * r2;
            return [x1, y1, x2, y2]
        }


        /**
         * Function Name: getColor
         * Description: Returns an interpolated color based on the input color name and index.
         *
         * @param {string} color - The name of the color palette (e.g., "blue", "green").
         * @param {number} color_index - The index of the color within the palette.
         * @returns {string} - The interpolated color value.
         */
        function getColor(color: string, color_index: number) {
            if (color == "blue") {
                return d3.interpolateBlues(color_index)
            } else if (color == "green") {
                return d3.interpolateGreens(color_index)
            } else if (color == "purple") {
                return d3.interpolatePurples(color_index)
            } else if (color == "red") {
                return d3.interpolateReds(color_index)
            } else if (color == "grey") {
                return d3.interpolateGreys(color_index)
            } else if (color == "orange") {
                return d3.interpolateOranges(color_index)
            } else if (color == "bugn") {
               
                return d3.interpolateBuGn(color_index)
            } else if (color == "bupu") {
                return d3.interpolateBuPu(color_index)
            } else if (color == "gnbu") {
              
                return d3.interpolateGnBu(color_index)
            } else if (color == "orrd") {

                return d3.interpolateOrRd(color_index)
            } else if (color == "pubugn") {
                return d3.interpolatePuBuGn(color_index)
            } else if (color == "pubu") {
                return d3.interpolatePuBu(color_index)
            } else if (color == "purd") {
                return d3.interpolatePuRd(color_index)
            } else if (color == "rdpu") {
                return d3.interpolateRdPu(color_index)
            } else if (color == "ylgnbu") {
                return d3.interpolateYlGnBu(color_index)
            } else if (color == "ylgn") {
                return d3.interpolateYlGn(color_index)
            } else if (color == "ylorbr") {
                return d3.interpolateYlOrBr(color_index)
            } else if (color == "ylorrd") {
                return d3.interpolateYlOrRd(color_index)
            } else {
                return d3.interpolateRainbow(color_index)
            }
        }


        /**
         * Function Name: arcTween
         * Description: Defines a tweening function for transitioning between two arc shapes.
         *
         * @param {d3.Transition<SVGPathElement, any, any, any>} transition - The D3 transition object.
         * @param {number[]} arr - An array containing parameters for the transition (e.g., new end angle and arc generator).
         */
        function arcTween(transition, arr): void {

            transition.attrTween('d', (d) => {
                const interpolate = d3.interpolate(0, arr[0]);

                return (t) => {

                    d.endAngle = interpolate(t);
                    return arr[1](d);

                };
            });
        }

    }


    /**
     * Function Name: getFormattingModel
     * Description: Retrieves the formatting model for the visual, which includes formatting settings for cards and slices.
     *
     * @returns {powerbi.visuals.FormattingModel} - The formatting model containing formatting settings.
     */
     public getFormattingModel(): powerbi.visuals.FormattingModel {

        // CARD MAXIMUM VALUE
        const max_value: powerbi.visuals.FormattingCard = {
            description: "Maximum Value Settings",
            displayName: "Maximum Value",
            uid: "max_value_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "generalView",
                    propertyName: "totalValueType"
                },
                {
                    objectName: "generalView",
                    propertyName: "categoryToTotal",
                },
                {
                    objectName: "generalView",
                    propertyName: "fixedTotal"
                }
            ]
        }

        // GROUPS FOR CARD MAXIMUM VALUE
        const group_max_value_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "maxValue_general",
            slices: [
                {
                    displayName: "Total Value",
                    uid: "total_value_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "generalView",
                                propertyName: "totalValueType"
                            },
                            value: this.visualSettings.generalView.totalValueType
                         }
                    }
                }
            ]
        };


        // SLICES FOR CARD MAXIMUM VALUE 
        if (this.visualSettings.generalView.totalValueType == "sum") {

            for (const group of this.totalByCategory.filter(d => d.group != "total")) {

                group_max_value_general.slices.push({                 
                    displayName: group.group,
                    uid: "fixed_total_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "generalView",
                                propertyName: "categoryToTotal",
                                selector: group.identity.getSelector()
                            },
                            value: group.active
                            }
                    }
                })

            }  
        } else if (this.visualSettings.generalView.totalValueType == "fixed") {

            group_max_value_general.slices.push({                 
                    displayName: "Maximum Total",
                    uid: "fixed_total_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "generalView",
                                propertyName: "fixedTotal"
                            },
                            value: this.visualSettings.generalView.fixedTotal
                            }
                    }
                })

        }
        

        max_value.groups.push(group_max_value_general);





    
        // CARD LABEL
        const label: powerbi.visuals.FormattingCard = {
            description: "Label Settings",
            displayName: "Data Labels",
            uid: "label_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "labelFormatting",
                    propertyName: "showLabels"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "labelAlignment"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "displayUnits"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "decimalPlaces"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "labelAlignment"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "fontColor"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "fontFamily"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "size"
                },
                {
                    objectName: "labelFormatting",
                    propertyName: "textWeight"
                },
            ]
        }
        

        // GROUPS FOR CARD LABEL
        const group_options: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "label_options",
            slices: [
                {
                    displayName: "Show Labels",
                    uid: "show_labels_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelFormatting",
                                propertyName: "showLabels"
                            },
                            value: this.visualSettings.labelFormatting.showLabels
                        }
                    }
                },
                {                    
                    displayName: "Alignment",
                    uid: "alignment_slice",
                    disabled: (this.visualSettings.labelFormatting.showLabels || this.visualSettings.labelValueFormatting.showLabels) ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.AlignmentGroup,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelFormatting",
                                propertyName: "labelAlignment"
                            },
                            mode: powerbi.visuals.AlignmentGroupMode.Horizonal,
                            value: this.visualSettings.labelFormatting.labelAlignment
                        }
                    }
                }
            ]
        };

        const group_text: powerbi.visuals.FormattingGroup = {
            displayName: "Text",
            uid: "label_text",
            disabled: this.visualSettings.labelFormatting.showLabels ? false : true,
            slices: [
                {                    
                    displayName: "Color",
                    uid: "label_color",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelFormatting",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.labelFormatting.fontColor }
                        }
                    }
                },
                {
                    uid: "label_text_control",
                    displayName: "Font",
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "labelFormatting",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.labelFormatting.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "labelFormatting",
                                    propertyName: "size"
                                },
                                value: this.visualSettings.labelFormatting.size
                            },
                            bold: {
                                descriptor: {
                                    objectName: "labelFormatting",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.labelFormatting.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "labelFormatting",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.labelFormatting.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "labelFormatting",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.labelFormatting.fontUnderline
                        }
                        }
                    }
                }
            ]
        };

        label.groups.push(group_options);
        label.groups.push(group_text);











        // CARD VALUE LABEL
        const labelValue: powerbi.visuals.FormattingCard = {
            description: "Label Value Settings",
            displayName: "Data Values Labels",
            uid: "labelValue_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "labelValueFormatting",
                    propertyName: "showLabels"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "showPercentages"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "displayUnits"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "decimalPlaces"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontColor"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontFamily"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "size"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "textWeight"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontItalic"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontUnderline"
                }
            ]
        }
        

        // GROUPS FOR CARD LABEL
        const group_labelValue_options: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "group_labelValue_options",
            slices: [
                {
                    displayName: "Show Labels",
                    uid: "show_labels_slice_labelValue",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelValueFormatting",
                                propertyName: "showLabels"
                            },
                            value: this.visualSettings.labelValueFormatting.showLabels
                        }
                    }
                }
            ]
        };

        const group_labelValue_text: powerbi.visuals.FormattingGroup = {
            displayName: "Text",
            uid: "group_labelValue_text",
            disabled: this.visualSettings.labelValueFormatting.showLabels ? false : true,
            slices: [
                {                    
                    displayName: "Color",
                    uid: "label_color_labelValue",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelValueFormatting",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.labelValueFormatting.fontColor }
                        }
                    }
                },
                {
                    uid: "label_text_control_labelValue",
                    displayName: "Font",
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "labelValueFormatting",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.labelValueFormatting.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "labelValueFormatting",
                                    propertyName: "size"
                                },
                                value: this.visualSettings.labelValueFormatting.size
                            },
                            bold: {
                                descriptor: {
                                    objectName: "labelValueFormatting",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.labelValueFormatting.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "labelValueFormatting",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.labelValueFormatting.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "labelValueFormatting",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.labelValueFormatting.fontUnderline
                        }
                        }
                    }
                }
            ]
        };

        const group_labelValue_format: powerbi.visuals.FormattingGroup = {
            displayName: "Format",
            uid: "group_labelValue_format",
            disabled: this.visualSettings.labelValueFormatting.showLabels ? false : true,
            slices: [
                {                    
                    displayName: "Format",
                    uid: "showPercentages_slice_labelValue",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelValueFormatting",
                                propertyName: "showPercentages"
                            },
                            value: this.visualSettings.labelValueFormatting.showPercentages
                        }
                    }
                },
                {                    
                    displayName: "Units",
                    uid: "display_units_slice_labelValue",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelValueFormatting",
                                propertyName: "displayUnits"
                            },
                            value: this.visualSettings.labelValueFormatting.displayUnits
                        }
                    }
                },
                {
                    displayName: "Decimal Places",
                    uid: "label_decimalPlaces_labelValue",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelValueFormatting",
                                propertyName: "decimalPlaces"
                            },
                            value: this.visualSettings.labelValueFormatting.decimalPlaces
                        }
                    }
                }
            ]
        };

        labelValue.groups.push(group_labelValue_options);
        labelValue.groups.push(group_labelValue_format);
        labelValue.groups.push(group_labelValue_text);







        // CARD SEPARATOR LABEL
        const labelSeparator: powerbi.visuals.FormattingCard = {
            description: "Label Separator Settings",
            displayName: "Data Separator Label",
            uid: "labelSeparator_uid",
            disabled: (this.visualSettings.labelValueFormatting.showLabels && this.visualSettings.labelFormatting.showLabels) ? false : true,
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontColor"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontFamily"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "size"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "textWeight"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontItalic"
                },
                {
                    objectName: "labelValueFormatting",
                    propertyName: "fontUnderline"
                }
            ]
        }



        const group_labelSeparator_text: powerbi.visuals.FormattingGroup = {
            displayName: "Text",
            uid: "group_labelSeparator_text",
            slices: [
                {                    
                    displayName: "Color",
                    uid: "label_color_labelSeparator",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "labelSeparator",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.labelSeparator.fontColor }
                        }
                    }
                },
                {
                    uid: "label_text_control_labelSeparator",
                    displayName: "Font",
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "labelSeparator",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.labelSeparator.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "labelSeparator",
                                    propertyName: "size"
                                },
                                value: this.visualSettings.labelSeparator.size
                            },
                            bold: {
                                descriptor: {
                                    objectName: "labelSeparator",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.labelSeparator.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "labelSeparator",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.labelSeparator.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "labelSeparator",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.labelSeparator.fontUnderline
                            }
                        }
                    }
                }
            ]
        };

        labelSeparator.groups.push(group_labelSeparator_text)









        // CARD NUMBER LABELS QUARTERS
        const number_labels: powerbi.visuals.FormattingCard = {
            description: "Number Labels Quarters Settings",
            displayName: "Number Labels",
            uid: "number_labels_quarters_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "numberLabels",
                    propertyName: "showNumbers"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "fontColor"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "fontFamily"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "size"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "textWeight"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "fontItalic"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "fontUnderline"                    
                },
                {
                    objectName: "numberLabels",
                    propertyName: "quarterUnits"
                },
                {
                    objectName: "numberLabels",
                    propertyName: "decimalPlaces"
                },


            ]
        }

        // GROUPS FOR CARD NUMBER LABELS QUARTERS
        const group_number_labels_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "number_labels_general",
            slices: [
                {
                    displayName: "Show Numbers",
                    uid: "show_numbers_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "numberLabels",
                                propertyName: "showNumbers"
                            },
                            value: this.visualSettings.numberLabels.showNumbers
                        }
                    }
                },
            ]
        };


        const group_number_labels_text: powerbi.visuals.FormattingGroup = {
            displayName: "Text",
            uid: "number_labels_text",
            disabled: this.visualSettings.numberLabels.showNumbers ? false : true,
            slices: [
                {                    
                    displayName: "Color",
                    uid: "number_label_color",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "numberLabels",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.numberLabels.fontColor}
                        }
                    }
                },
                {
                    uid: "number_labels_control",
                    displayName: "Font",
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "numberLabels",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.numberLabels.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "numberLabels",
                                    propertyName: "size"
                                },
                                value: this.visualSettings.numberLabels.size
                            },
                            bold: {
                                descriptor: {
                                    objectName: "numberLabels",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.numberLabels.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "numberLabels",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.numberLabels.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "numberLabels",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.numberLabels.fontUnderline
                        }
                        }
                    }
                }                
            ]
        };


        const group_number_labels_format: powerbi.visuals.FormattingGroup = {
            displayName: "Format",
            uid: "number_labels_format",
            disabled: this.visualSettings.numberLabels.showNumbers ? false : true,
            slices: [
                {                    
                    displayName: "Units",
                    uid: "quarter_display_units_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "numberLabels",
                                propertyName: "quarterUnits"
                            },
                            value: this.visualSettings.numberLabels.quarterUnits
                        }
                    }
                },
                {
                    displayName: "Decimal Places",
                    uid: "number_label_decimalPlaces",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "numberLabels",
                                propertyName: "decimalPlaces"
                            },
                            value: this.visualSettings.numberLabels.decimalPlaces
                        }
                    }
                }   
            ]
        };


           
        number_labels.groups.push(group_number_labels_general);   
        number_labels.groups.push(group_number_labels_text);  
        number_labels.groups.push(group_number_labels_format); 






        // CARD RADIAL BAR
        const radial_bar: powerbi.visuals.FormattingCard = {
            description: "Radial Bar Settings",
            displayName: "Radial Bar",
            uid: "radial_bar_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "radialSettings",
                    propertyName: "activateDrilldown"
                },
                {
                    objectName: "radialSettings",
                    propertyName: "radius"
                },
                {
                    objectName: "radialSettings",
                    propertyName: "startingOpacity",
                },
                {
                    objectName: "radialSettings",
                    propertyName: "opacitySteps",
                },
                {
                    objectName: "radialSettings",
                    propertyName: "shadowVisible"
                },
                {
                    objectName: "radialSettings",
                    propertyName: "shadowColor",
                },
                {
                    objectName: "group_radial_bar_shadow",
                    propertyName: "shadowOpacity",
                },
                {
                    objectName: "radialSettings",
                    propertyName: "colorScheme"
                },
                {
                    objectName: "radialSettings",
                    propertyName: "color"
                },
                {
                    objectName: "radialSettings",
                    propertyName: "hexaColor"
                },
                {
                    objectName: "radialSettings",
                    propertyName: "color_alternative"
                },
            ]
        }

        // GROUPS FOR RADIAL BAR
        const group_radial_bar_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "radial_bar_general",
            slices: [
                {
                    displayName: "Enable Drill Down",
                    uid: "drill_down_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "activateDrilldown"
                            },
                            value: this.visualSettings.radialSettings.activateDrilldown
                        }
                    }
                },
            ]
        }; 

        const group_radial_bar_design: powerbi.visuals.FormattingGroup = {
            displayName: "Design",
            uid: "radial_bar_design",
            slices: [
                {
                    displayName: "Border Curveness",
                    uid: "border_curveness_slider",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "radius"
                            },
                            value: this.visualSettings.radialSettings.radius
                        }
                    }
                },
                {
                    displayName: "Starting Opacity",
                    uid: "bar_opacity",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "startingOpacity",
                            },
                            value: this.visualSettings.radialSettings.startingOpacity
                        }
                    }
                },
                {
                    displayName: "Step incrementation for color schemes",
                    uid: "step_incremnetation_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "opacitySteps",
                            },
                            value: this.visualSettings.radialSettings.opacitySteps
                        }
                    }
                }
            ]
        }; 

        const group_radial_bar_shadow: powerbi.visuals.FormattingGroup = {
            displayName: "Background",
            uid: "radial_bar_shadow",
            slices: [
                {                    
                    displayName: "Type of Background",
                    uid: "backgroud_type_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "shadowVisible"
                            },
                            value: this.visualSettings.radialSettings.shadowVisible
                        }
                    }
                },
                {
                    displayName: "Color",
                    uid: "shadow_color",
                    disabled: this.visualSettings.radialSettings.shadowVisible == "shadow" ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "shadowColor",
                            },
                            value: { value: this.visualSettings.radialSettings.shadowColor }
                        }
                    }
            
                },
                {
                    displayName: "Opacity",
                    uid: "shadow_opacity",
                    disabled: this.visualSettings.radialSettings.shadowVisible == "shadow" ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "group_radial_bar_shadow",
                                propertyName: "shadowOpacity",
                            },
                            value: this.visualSettings.radialSettings.shadowOpacity
                        }
                    }
                }
            ]
        };

        const group_radial_bar_colors: powerbi.visuals.FormattingGroup = {
            displayName: "Colors",
            uid: "radial_bar_colors_jidfhuidrfghdrfgu",
            slices: [
                {                    
                    displayName: "Color Scheme",
                    uid: "color_scheme_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "radialSettings",
                                propertyName: "colorScheme"
                            },
                            value: this.visualSettings.radialSettings.colorScheme
                        }
                    }
                },
            ]
        };   
        

        for (const object of this.viewModel.dataPoints.map(d => d.os).filter(this.onlyUnique)) {
            
            if (this.visualSettings.radialSettings.colorScheme == "color"){

                group_radial_bar_colors.slices.push(

                    {
                        displayName: object + " Color",
                        uid: "color",
                        control: {
                            type: powerbi.visuals.FormattingComponent.Dropdown,
                            properties: {
                                descriptor:
                                {
                                    objectName: "radialSettings",
                                    propertyName: "color",
                                    selector: this.viewModel.dataPoints.filter(d => d.os == object)[0].identity.getSelector()
                                },
                                value: this.viewModel.dataPoints.filter(d => d.os == object)[0].color 
                            }
                        }
                    }
                )
            } else if (this.visualSettings.radialSettings.colorScheme == "hexaColor"){
                group_radial_bar_colors.slices.push(

                    {
                        displayName: object + " Color",
                        uid: "hexacolor",
                        control: {
                            type: powerbi.visuals.FormattingComponent.ColorPicker,
                            properties: {
                                descriptor:
                                {
                                    objectName: "radialSettings",
                                    propertyName: "hexaColor",
                                    selector: this.viewModel.dataPoints.filter(d => d.os == object)[0].identity.getSelector()
                                },
                                value: { value: this.viewModel.dataPoints.filter(d => d.os == object)[0].color }
                            }
                        }                        
                    }

                )
            } else {

                group_radial_bar_colors.slices.push(

                    {
                        displayName: object + " Color",
                        uid: "color_alternative",
                        control: {
                            type: powerbi.visuals.FormattingComponent.Dropdown,
                            properties: {
                                descriptor:
                                {
                                    objectName: "radialSettings",
                                    propertyName: "color_alternative",
                                    selector: this.viewModel.dataPoints.filter(d => d.os == object)[0].identity.getSelector()
                                },
                                value: this.viewModel.dataPoints.filter(d => d.os == object)[0].color 
                            }
                        }                        
                    }

                )

            }
        }



        radial_bar.groups.push(group_radial_bar_general);  
        radial_bar.groups.push(group_radial_bar_design);  
        radial_bar.groups.push(group_radial_bar_colors);  
        radial_bar.groups.push(group_radial_bar_shadow);  




        //CARD OUTSIDE CIRCLE
        const outside_circle: powerbi.visuals.FormattingCard = {
            description: "Outside Circle Settings",
            displayName: "Outside Circle",
            uid: "outside_circle_uid",            
            disabled: this.visualSettings.radialSettings.shadowVisible == "shadow" ? false : true,
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "lineSettings",
                    propertyName: "lineVisible",
                },
                {
                    objectName: "lineSettings",
                    propertyName: "linecolor"
                },
                {
                    objectName: "lineSettings",
                    propertyName: "linethickness"
                }
            ]
        }

        const group_outside_circle: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "outside_circle",
            slices: [
                {
                    displayName: "Show line",
                    uid: "show_line_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "lineSettings",
                                propertyName: "lineVisible",
                            },
                            value: this.visualSettings.lineSettings.lineVisible
                         }
                    }
                }
            ]
        }; 
        
        const group_outside_circle_design: powerbi.visuals.FormattingGroup = {
            displayName: "Design",
            uid: "outside_circle_design",
            disabled: this.visualSettings.lineSettings.lineVisible ? false : true,
            slices: [
                {
                    displayName: "Color",
                    uid: "outside_line_color_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "lineSettings",
                                propertyName: "linecolor"
                            },
                            value: { value: this.visualSettings.lineSettings.linecolor }
                        }
                    }                        
                },
                {
                    displayName: "Width",
                    uid: "outside_line_tickness_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "lineSettings",
                                propertyName: "linethickness"
                            },
                            value: this.visualSettings.lineSettings.linethickness 
                        }
                    }                        
                }
            ]
        }; 




        outside_circle.groups.push(group_outside_circle); 
        outside_circle.groups.push(group_outside_circle_design); 
        

        
        
          





        //CARD OUTSIDE CIRCLE
        const quarter_reference: powerbi.visuals.FormattingCard = {
            description: "Quarter Reference Settings",
            displayName: "Quarter Reference Line",
            uid: "quarter_reference_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "referenceLine",
                    propertyName: "showReferenceLines",
                },
                {
                    objectName: "referenceLine",
                    propertyName: "sonarLinesColor"
                },
                {
                    objectName: "referenceLine",
                    propertyName: "dashline"
                },
                {
                    objectName: "referenceLine",
                    propertyName: "sonarLineWidth"
                },
                {
                    objectName: "referenceLine",
                    propertyName: "sonarOpacity"
                },
            ]
        }


        const group__quarter_reference_line: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "quarter_reference_uid",
            slices: [
                {
                    displayName: "Show Reference Lines",
                    uid: "show_reference_line_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "referenceLine",
                                propertyName: "showReferenceLines",
                            },
                            value: this.visualSettings.referenceLine.showReferenceLines
                         }
                    }
                }
            ]
        };

        const group__quarter_reference_line_design: powerbi.visuals.FormattingGroup = {
            displayName: "Design",
            uid: "quarter_reference_design_uid",
            disabled: this.visualSettings.referenceLine.showReferenceLines ? false : true,
            slices: [
                {
                    displayName: "Color",
                    uid: "reference_line_color_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "referenceLine",
                                propertyName: "sonarLinesColor"
                            },
                            value: { value: this.visualSettings.referenceLine.sonarLinesColor }
                        }
                    }                        
                },
                {
                    displayName: "Dash Interval",
                    uid: "dash_interval_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "referenceLine",
                                propertyName: "dashline"
                            },
                            value: this.visualSettings.referenceLine.dashline
                        }
                    }                        
                },
                {
                    displayName: "Width",
                    uid: "reference_line_Width_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "referenceLine",
                                propertyName: "sonarLineWidth"
                            },
                            value: this.visualSettings.referenceLine.sonarLineWidth
                        }
                    }                        
                },
                {
                    displayName: "Opacity",
                    uid: "reference_line_opacity_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "referenceLine",
                                propertyName: "sonarOpacity"
                            },
                            value: this.visualSettings.referenceLine.sonarOpacity
                        }
                    }                        
                }
            ]
        };

        quarter_reference.groups.push(group__quarter_reference_line);  
        quarter_reference.groups.push(group__quarter_reference_line_design);   





        // CARD GO BACK ARROW
        const goBack_arrow: powerbi.visuals.FormattingCard = {
        description: "Icon Settings",
        displayName: "Go Back",
        uid: "goBack_uid",
        groups: [],
        revertToDefaultDescriptors: [
            {
                objectName: "iconHome",
                propertyName: "size"
            },
            {
                objectName: "iconHome",
                propertyName: "icon"
            },
            {
                objectName: "iconHome",
                propertyName: "allowGoBack_category",
            },
            {
                objectName: "iconHome",
                propertyName: "allowGoBack_label",
            },
            {
                objectName: "iconHome",
                propertyName: "default_icon",
            },
            {
                objectName: "iconHome",
                propertyName: "show_label",
            },
            {
                objectName: "iconHome",
                propertyName: "allowGoBack_blank_space",
            },
            {
                objectName: "iconHome",
                propertyName: "y_position"
            },
            {
                objectName: "iconHome",
                propertyName: "x_position",
            },
            {
                objectName: "iconHome",
                propertyName: "fontColor"
            },
            {
                objectName: "iconHome",
                propertyName: "fontFamily"
            },
            {
                objectName: "iconHome",
                propertyName: "label_size"
            },
            {
                objectName: "iconHome",
                propertyName: "textWeight"
            },
            {
                objectName: "iconHome",
                propertyName: "fontItalic"
            },
            {
                objectName: "iconHome",
                propertyName: "fontUnderline"
            },
        ]
        }

        // GROUPS FOR GO BACK ARROW
        const goBack_settings: powerbi.visuals.FormattingGroup = {
            displayName: "When",
            uid: "goBack_settings",
            slices: [
                {
                    displayName: "Clicking Bar",
                    uid: "back_when_click_category_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "allowGoBack_category",
                            },
                            value: this.visualSettings.iconHome.allowGoBack_category
                            }
                    }
                },
                {
                    displayName: "Clicking Label",
                    uid: "back_when_click_label_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "allowGoBack_label",
                            },
                            value: this.visualSettings.iconHome.allowGoBack_label
                            }
                    }
                },
                {
                    displayName: "Clicking Blank Space",
                    uid: "back_when_click_blank_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "allowGoBack_blank_space",
                            },
                            value: this.visualSettings.iconHome.allowGoBack_blank_space
                            }
                    }
                }
            ]
        }; 

        const goBack_general: powerbi.visuals.FormattingGroup = {
            displayName: "Icon",
            uid: "goBack_icon",
            slices: [
                {
                    displayName: "Size",
                    uid: "icon_size_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "size"
                            },
                            value: this.visualSettings.iconHome.size
                        }
                    }                        
                }              
            ]
        }; 

        const goBack_position: powerbi.visuals.FormattingGroup = {
            displayName: "Position",
            uid: "goBack_icon_position",
            slices: [
                {
                    displayName: "X",
                    uid: "xPosition_icon_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "x_position",
                            },
                            value: this.visualSettings.iconHome.x_position
                            }
                    }
                },
                {
                    displayName: "Y",
                    uid: "yPosition_icon_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "y_position"
                            },
                            value: this.visualSettings.iconHome.y_position
                        }
                    }                        
                }                  
            ]
        }; 

        const goBack_label: powerbi.visuals.FormattingGroup = {
            displayName: "Label",
            uid: "goBack_label",
            slices: [
                {
                    displayName: "Show Label",
                    uid: "icon_label_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "show_label",
                            },
                            value: this.visualSettings.iconHome.show_label
                            }
                    }
                },
                {                    
                    displayName: "Color",
                    uid: "iconHome_label_color",
                    disabled: this.visualSettings.iconHome.show_label ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "iconHome",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.iconHome.fontColor}
                        }
                    }
                },
                {
                    uid: "iconHome_label_control",
                    displayName: "Font",
                    disabled: this.visualSettings.iconHome.show_label ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "iconHome",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.iconHome.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "iconHome",
                                    propertyName: "label_size"
                                },
                                value: this.visualSettings.iconHome.label_size
                            },
                            bold: {
                                descriptor: {
                                    objectName: "iconHome",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.iconHome.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "iconHome",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.iconHome.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "iconHome",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.iconHome.fontUnderline
                        }
                        }
                    }
                }     
            ]
        }; 


        goBack_arrow.groups.push(goBack_settings);
        goBack_arrow.groups.push(goBack_general);  
        goBack_arrow.groups.push(goBack_position);  
        goBack_arrow.groups.push(goBack_label);  





        // CARD TARGET VALUES
        const target_values: powerbi.visuals.FormattingCard = {
            description: "Target Value Settings",
            displayName: "Target Value",
            uid: "target_values_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "targetSettings",
                    propertyName: "showTarget",
                },
                {
                    objectName: "targetSettings",
                    propertyName: "targetType",
                },
                {
                    objectName: "targetSettings",
                    propertyName: "quarterUnits",
                },
                {
                    objectName: "targetSettings",
                    propertyName: "decimalPlaces",
                },
                {
                    objectName: "targetSettings",
                    propertyName: "fixedTarget"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "targetLineColor"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "targetLineOpacity"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "targetLineWidth"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "showLabel",
                },
                {
                    objectName: "targetSettings",
                    propertyName: "title",
                },
                {
                    objectName: "targetSettings",
                    propertyName: "fontColor"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "fontFamily"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "fontSize"                    
                },
                {
                    objectName: "targetSettings",
                    propertyName: "textWeight"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "fontItalic"
                },
                {
                    objectName: "targetSettings",
                    propertyName: "fontUnderline"
                }
            ]
        }

        // GROUPS FOR CARD TARGET VALUES


        
        const group_target_values_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "target_values_general",
            slices: [
                {
                    displayName: "Show Target Reference",
                    uid: "show_reference_target_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "showTarget",
                            },
                            value: this.visualSettings.targetSettings.showTarget
                         }
                    }
                },
                {
                    displayName: "Target value",
                    uid: "target_value_slice",
                    disabled: !this.existTargetMetric && this.visualSettings.targetSettings.showTarget ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "fixedTarget"
                            },
                            value: this.visualSettings.targetSettings.fixedTarget
                        }
                    }
                },   
                {
                    displayName: "Visual Format",
                    uid: "visual_format_target_slice",
                    disabled: this.visualSettings.targetSettings.showTarget ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "targetType",
                            },
                            value: this.visualSettings.targetSettings.targetType
                         }
                    }
                },
                {
                    displayName: "Units",
                    uid: "display_units_target_slice",
                    disabled: this.visualSettings.targetSettings.showTarget ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "quarterUnits",
                            },
                            value: this.visualSettings.targetSettings.quarterUnits
                         }
                    }
                },  
                {
                    displayName: "Decimal Places",
                    uid: "decimal_places_target_slice",
                    disabled: this.visualSettings.targetSettings.showTarget ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "decimalPlaces",
                            },
                            value: this.visualSettings.targetSettings.decimalPlaces
                         }
                    }
                },             
            ]
        }; 


        const group_target_title_text: powerbi.visuals.FormattingGroup = {
            displayName: "Title",
            uid: "group_target_title_text",
            disabled: this.visualSettings.targetSettings.showTarget ? false : true,
            slices: [
                {
                    displayName: "Title",
                    uid: "label_target_title_slice",
                    disabled: this.visualSettings.targetSettings.showLabel && this.visualSettings.targetSettings.showTarget ? false : true, 
                    control: {
                        type: powerbi.visuals.FormattingComponent.TextInput,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetTitle",
                                propertyName: "title",
                            },
                            placeholder: "Write the title here",
                            value: this.visualSettings.targetTitle.title
                         }
                    }
                },
                {                    
                    displayName: "Color",
                    uid: "target_title_label_color",
                    disabled: this.visualSettings.targetSettings.showLabel && this.visualSettings.targetSettings.showTarget ? false : true, 
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetTitle",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.targetTitle.fontColor}
                        }
                    }
                },
                {
                    uid: "target_title_label_text_control",
                    displayName: "Font",
                    disabled: this.visualSettings.targetSettings.showLabel && this.visualSettings.targetSettings.showTarget ? false : true, 
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "targetTitle",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.targetTitle.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "targetTitle",
                                    propertyName: "fontSize"
                                },
                                value: this.visualSettings.targetTitle.fontSize
                            },
                            bold: {
                                descriptor: {
                                    objectName: "targetTitle",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.targetTitle.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "targetTitle",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.targetTitle.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "targetTitle",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.targetTitle.fontUnderline
                        }
                        }
                    }
                }     
            ]
        };



        const group_target_values_text: powerbi.visuals.FormattingGroup = {
            displayName: "Text",
            uid: "target_values_text",
            disabled: this.visualSettings.targetSettings.showTarget ? false : true,
            slices: [
                {
                    displayName: "Show Label",
                    uid: "show_label_target_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "showLabel",
                            },
                            value: this.visualSettings.targetSettings.showLabel
                         }
                    }
                },
                {                    
                    displayName: "Color",
                    uid: "target_label_color",
                    disabled: this.visualSettings.targetSettings.showLabel && this.visualSettings.targetSettings.showTarget ? false : true, 
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "fontColor"
                            },
                            value: { value: this.visualSettings.targetSettings.fontColor}
                        }
                    }
                },
                {
                    uid: "target_label_text_control",
                    displayName: "Font",
                    disabled: this.visualSettings.targetSettings.showLabel && this.visualSettings.targetSettings.showTarget ? false : true, 
                    control: {
                        type: powerbi.visuals.FormattingComponent.FontControl,
                        properties: {
                            fontFamily: {
                                descriptor: {
                                    objectName: "targetSettings",
                                    propertyName: "fontFamily"
                                },
                                value: this.visualSettings.targetSettings.fontFamily
                            },
                            fontSize: {
                                descriptor: {
                                    objectName: "targetSettings",
                                    propertyName: "fontSize"
                                },
                                value: this.visualSettings.targetSettings.fontSize
                            },
                            bold: {
                                descriptor: {
                                    objectName: "targetSettings",
                                    propertyName: "textWeight"
                                },
                                value: this.visualSettings.targetSettings.textWeight
                            },
                            italic: {
                                descriptor: {
                                    objectName: "targetSettings",
                                    propertyName: "fontItalic"
                                },
                                value: this.visualSettings.targetSettings.fontItalic
                            },
                            underline: {
                                descriptor: {
                                    objectName: "targetSettings",
                                    propertyName: "fontUnderline"
                                },
                                value: this.visualSettings.targetSettings.fontUnderline
                        }
                        }
                    }
                }     
            ]
        };





        const group_target_values_design: powerbi.visuals.FormattingGroup = {
            displayName: "Design",
            uid: "target_values_design",
            disabled: this.visualSettings.targetSettings.showTarget ? false : true,
            slices: [
                {                    
                    displayName: "Color",
                    uid: "target_color_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ColorPicker,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "targetLineColor"
                            },
                            value: { value: this.visualSettings.targetSettings.targetLineColor}
                        }
                    }
                },
                {
                    displayName: "Opacity",
                    uid: "line_opacity_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Slider,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "targetLineOpacity"
                            },
                            value: this.visualSettings.targetSettings.targetLineOpacity
                        }
                    }
                }, 
                {
                    displayName: "Width",
                    uid: "line_width_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "targetSettings",
                                propertyName: "targetLineWidth"
                            },
                            value: this.visualSettings.targetSettings.targetLineWidth
                        }
                    }
                },  
            ]
        }; 


        target_values.groups.push(group_target_values_general);  
        target_values.groups.push(group_target_values_design)
        target_values.groups.push(group_target_values_text);
        target_values.groups.push(group_target_title_text);

        

        // CARD ANIMATION
        const animation: powerbi.visuals.FormattingCard = {
            description: "Animation Settings",
            displayName: "Animation",
            uid: "animation_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "animationSettings",
                    propertyName: "enableAnimations",
                },
                {
                    objectName: "animationSettings",
                    propertyName: "duration"
                },
            ]
        }

        // GROUPS FOR CARD ANIMATION
        const group_animation_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "animation_general",
            slices: [
                {
                    displayName: "Enable Animations?",
                    uid: "enable_animations_slice",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "animationSettings",
                                propertyName: "enableAnimations",
                            },
                            value: this.visualSettings.animationSettings.enableAnimations
                         }
                    }
                },
                {
                    displayName: "Duration between transitions (in seconds)",
                    uid: "animation_duration_slicer",
                    disabled: this.visualSettings.animationSettings.enableAnimations ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor:
                            {
                                objectName: "animationSettings",
                                propertyName: "duration"
                            },
                            value: this.visualSettings.animationSettings.duration
                    }
                }
                }, 
            ]
        }; 

        animation.groups.push(group_animation_general);  
        



        // CARD TOOLTIP
        const tooltip: powerbi.visuals.FormattingCard = {
            description: "Tooltip Settings",
            displayName: "Tooltip",
            uid: "tooltip_uid",
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "tooltipSettings",
                    propertyName: "removeMeasure"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "removeCategory"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "titleMeasure"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "tooltipUnits"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "decimalPlaces"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "showDescription"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "description"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "titleDescription"
                },
                {
                    objectName: "tooltipSettings",
                    propertyName: "showExtraValue"
                },
            ]
        }

        // GROUPS FOR CARD TOOLTIP
        const group_tooltip_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "tooltip_general",
            slices: [
                {
                    displayName: "Hide Group Total Value",
                    uid: "tooltip_hide_total_value",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "removeMeasure"
                            },
                            value: this.visualSettings.tooltipSettings.removeMeasure
                        }
                    }
                },
                {
                    displayName: "Hide Category Sub-Total Value",
                    uid: "tooltip_hide_category_value",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "removeCategory"
                            },
                            value: this.visualSettings.tooltipSettings.removeCategory
                        }
                    }
                }
            ]
        }; 


        const group_tooltip_value: powerbi.visuals.FormattingGroup = {
            displayName: "Value",
            uid: "tooltip_value",
            disabled: this.visualSettings.tooltipSettings.removeMeasure ? true : false,
            slices: [
                {       
                    displayName: "Title",           
                    uid: "title_tooltip",
                    control: {
                        type: powerbi.visuals.FormattingComponent.TextInput,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "titleMeasure"
                            },
                            placeholder: "Write the title", 
                            value: this.visualSettings.tooltipSettings.titleMeasure
                        }
                    }
                },
                {                    
                    displayName: "Display Units (Reference number: 1500)",
                    uid: "tooltipUnits",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "tooltipUnits"
                            },
                            value: this.visualSettings.tooltipSettings.tooltipUnits
                        }
                    }
                },
                {
                    displayName: "Decimal Places",
                    uid: "tooltip_decimal_places",
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor: {
                                objectName: "tooltipSettings",
                                propertyName: "decimalPlaces"
                            },
                            value: this.visualSettings.tooltipSettings.decimalPlaces
                        }
                    }
                },
                {
                    displayName: "Show Extra Value",
                    uid: "tooltip_show_extra_value",
                    disabled: this.extraTooltip != null ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "showExtraValue"
                            },
                            value: this.visualSettings.tooltipSettings.showExtraValue
                        }
                    }
                }
            ]
        }



        const group_tooltip_description: powerbi.visuals.FormattingGroup = {
            displayName: "Description",
            uid: "tooltip_description",
            slices: [
                {
                    displayName: "Show Description",
                    uid: "tooltip_show_description",
                    control: {
                        type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "showDescription"
                            },
                            value: this.visualSettings.tooltipSettings.showDescription
                        }
                    }
                },
                {       
                    displayName: "Description",           
                    uid: "description_tooltip",
                    disabled: this.visualSettings.tooltipSettings.showDescription ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.TextInput,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "description"
                            },
                            placeholder: "Write the description", 
                            value: this.visualSettings.tooltipSettings.description
                        }
                    }
                },
                {       
                    displayName: "Title",           
                    uid: "description_title_tooltip",
                    disabled: this.visualSettings.tooltipSettings.showDescription ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.TextInput,
                        properties: {
                            descriptor:
                            {
                                objectName: "tooltipSettings",
                                propertyName: "titleDescription"
                            },
                            placeholder: "Write the title for the description", 
                            value: this.visualSettings.tooltipSettings.titleDescription
                        }
                    }
                },
            ]
        }


        tooltip.groups.push(group_tooltip_general);  
        tooltip.groups.push(group_tooltip_value);  
        tooltip.groups.push(group_tooltip_description);  



        


        // Initialize secondMeasure outside of the if block
        const secondMeasure: powerbi.visuals.FormattingCard = {
            description: "Second Measure Settings",
            displayName: "Second Measure",
            uid: "secondMeasure_uid",
            disabled: this.showSecondMeasureSettings ? false : true,
            groups: [],
            revertToDefaultDescriptors: [
                {
                    objectName: "secondMeasureSettings",
                    propertyName: "showValue"
                },
                {
                    objectName: "secondMeasureSettings",
                    propertyName: "quarterUnits"
                },
                {
                    objectName: "secondMeasureSettings",
                    propertyName: "quarterUnits"
                },
                {
                    objectName: "secondMeasureSettings",
                    propertyName: "labelUnits"
                },
                {
                    objectName: "secondMeasureSettings",
                    propertyName: "tooltipUnits"
                },
                {
                    objectName: "secondMeasureSettings",
                    propertyName: "decimalPlaces"
                },
            ]
        }

        // GROUPS SECOND MEASURE
        const group_secondMeasure_general: powerbi.visuals.FormattingGroup = {
            displayName: "Options",
            uid: "secondMeasure_general",
            disabled: this.showSecondMeasureSettings ? false : true,
            slices: [
                {
                    displayName: "What value should appear on drill down?",
                    uid: "show_value_secondMeasure",
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "secondMeasureSettings",
                                propertyName: "showValue"
                            },
                            value: this.visualSettings.secondMeasureSettings.showValue
                        }
                    }
                },
                {
                    displayName: "Quarter Display Units",
                    uid: "secondMeasure_quarter_display_units",
                    disabled: this.existsSecondMeasure ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "secondMeasureSettings",
                                propertyName: "quarterUnits"
                            },
                            value: this.visualSettings.secondMeasureSettings.quarterUnits
                        }
                    }
                },
                {
                    displayName: "Label Display Units",
                    uid: "secondMeasure_label_display_units",
                    disabled: this.existsSecondMeasure ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "secondMeasureSettings",
                                propertyName: "labelUnits"
                            },
                            value: this.visualSettings.secondMeasureSettings.labelUnits
                        }
                    }
                },
                {
                    displayName: "Tooltip Display Units",
                    uid: "secondMeasure_label_display_units",
                    disabled: this.existsSecondMeasure ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.Dropdown,
                        properties: {
                            descriptor:
                            {
                                objectName: "secondMeasureSettings",
                                propertyName: "tooltipUnits"
                            },
                            value: this.visualSettings.secondMeasureSettings.tooltipUnits
                        }
                    }
                },
                {
                    displayName: "Value Decimal Places",
                    uid: "secondMeasure_value_decimal_places",
                    disabled: this.existsSecondMeasure ? false : true,
                    control: {
                        type: powerbi.visuals.FormattingComponent.NumUpDown,
                        properties: {
                            descriptor: {
                                objectName: "secondMeasureSettings",
                                propertyName: "decimalPlaces"
                            },
                            value: this.visualSettings.secondMeasureSettings.decimalPlaces
                        }
                    }
                }
            ]
        };

        secondMeasure.groups.push(group_secondMeasure_general);




        // Initialize formattingModel with an empty array or with secondMeasure if it's defined
        const formattingModel: powerbi.visuals.FormattingModel = {
            cards: [max_value, label, labelValue, labelSeparator, number_labels, radial_bar, outside_circle, quarter_reference, target_values, goBack_arrow, animation, tooltip]
        };


        if (secondMeasure) {
            formattingModel.cards.push(secondMeasure);
        }


        return formattingModel;
    } 



    /**
     * Function Name: measureWordHeight
     * Description: Measures the height of a word based on font size and font family.
     *
     * @param {string} word - The word to measure.
     * @param {string} fontSize - The font size in pixels.
     * @param {string} fontFamily - The font family for the word.
     * @returns {number} - The height of the word in pixels.
     */
    private measureWordHeight(word: string, fontSize: number, fontFamily: string) {

        const textProperties: TextProperties = {
            text: word,
            fontFamily: fontFamily,
            fontSize: fontSize + "pt"
        };

        const label_size = this.measureSvgTextHeight(textProperties)

        return label_size
    }



    /**
     * Function Name: measureSvgTextHeight
     * Description: Measures the height of SVG text based on text properties.
     *
     * @param {object} textProperties - An object containing text properties such as font size, font family, etc.
     * @returns {number} - The height of the SVG text in pixels.
     */
    private measureSvgTextHeight(textProperties) {
        this.ensureDOM();
        this.canvasCty.font =
            (textProperties.fontStyle || "") + " " +
            (textProperties.fontVariant || "") + " " +
            (textProperties.fontWeight || "") + " " +
            textProperties.fontSize + " " +
            (textProperties.fontFamily || this.fallbackFontFamily);

        return (this.canvasCty.measureText(textProperties.text).actualBoundingBoxAscent + this.canvasCty.measureText(textProperties.text).actualBoundingBoxDescent) * 1.15
    }



    /**
     * Function Name: ensureDOM
     * Description: Ensures the presence of necessary DOM elements for measuring text properties.
     */
    private ensureDOM() {
        if (this.spanElement) {
            return;
        }
        this.spanElement = document.createElement("span");
        document.body.appendChild(this.spanElement);
        // The style hides the svg element from the canvas, preventing canvas from scrolling down to show svg black square.
        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute("height", "0");
        svgElement.setAttribute("width", "0");
        svgElement.setAttribute("position", "absolute");
        svgElement.style.top = "0px";
        svgElement.style.left = "0px";
        svgElement.style.position = "absolute";
        svgElement.style.height = "0px";
        svgElement.style.width = "0px";
        this.svgTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        svgElement.appendChild(this.svgTextElement);
        document.body.appendChild(svgElement);
        const canvasElement = document.createElement("canvas");
        this.canvasCty = canvasElement.getContext("2d");
        const style = window.getComputedStyle(this.svgTextElement);
        if (style) {
            this.fallbackFontFamily = style.fontFamily;
        }
        else {
            this.fallbackFontFamily = "";
        }
    }


    /**
     * Function Name: measureWordWidth
     * Description: Measures the width of a word based on font size and font family.
     *
     * @param {string} word - The word to measure.
     * @param {string} fontSize - The font size in pixels.
     * @param {string} fontFamily - The font family for the word.
     * @returns {number} - The width of the word in pixels.
     */
    private measureWordWidth(word: string, fontSize: number, fontFamily: string, isBold: boolean, isItalic: boolean): number {
        // Check for the actual text styling (bold, italic, underline)
        const fontWeight = isBold ? "bold" : "normal";
        const fontStyle = isItalic ? "italic" : "normal";
    
        // Create text properties including font style, weight, and decoration
        const textProperties: TextProperties = {
            text: word,
            fontFamily: fontFamily,
            fontSize: fontSize + "pt",
            fontWeight: fontWeight,
            fontStyle: fontStyle
        };
    
        // Measure the text width with the appropriate style
        const label_size = textMeasurementService.measureSvgTextWidth(textProperties);
    
        return label_size;
    }
    

    /**
     * Function Name: measureBiggestWordSpacing
     * Description: Measures the width of the longest word in an array based on font size and font family.
     *
     * @param {string[]} array - An array of words to find the longest word from.
     * @param {string} fontSize - The font size in pixels.
     * @param {string} fontFamily - The font family for the words.
     * @returns {number} - The width of the longest word in pixels.
     */
    private measureBiggestWordSpacing(array, fontSize: number, fontFamily: string) {
        const longest = array.reduce(function (a, b) { return a.length > b.length ? a : b; });

        const textProperties: TextProperties = {
            text: longest,
            fontFamily: fontFamily,
            fontSize: fontSize + "pt"
        };

        const label_size = textMeasurementService.measureSvgTextWidth(textProperties)

        return label_size
    }

    private onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }


    /**
     * Function Name: getTooltipData
     * Description: Constructs tooltip data based on the provided object data and context, considering various tooltip settings.
     *
     * @param {TooltipEventArgs<DataPoint>} objectData - The object data containing information for the tooltip.
     * @param {any} context - The context or reference for constructing the tooltip data.
     * @returns {VisualTooltipDataItem[]} - An array of tooltip data items for display.
     */
    private getTooltipData(objectData : TooltipEventArgs<DataPoint>): VisualTooltipDataItem[] {

        const identifier = objectData["category"]
        let tooltip = null

        if (this.categorySelected) {
            tooltip = this.viewModel.dataPoints.filter(d => d.category == identifier)[0].tooltips
        } else {
            
            tooltip = [{
                displayName: this.visualSettings.tooltipSettings.showDescription ? "" : "Group",
                value: <string>identifier
            }]
            
            if (!this.visualSettings.tooltipSettings.removeMeasure) {
                const totalValue = this.viewModel.dataPoints.filter(d => d.os == identifier).map(d => d.value).reduce((a, b) => a + b, 0)
                tooltip.push({
                    displayName: this.visualSettings.tooltipSettings.titleMeasure == "" ? this.valueColumnName : this.visualSettings.tooltipSettings.titleMeasure,
                    value: this.formatValue(totalValue, this.defaultCubeFormat, this.visualSettings.tooltipSettings.decimalPlaces, this.visualSettings.tooltipSettings.tooltipUnits)
                })                
            }

            if (!this.visualSettings.tooltipSettings.removeCategory) {
                tooltip.push({
                    displayName: objectData["group"],
                    value: this.formatValue(objectData["value"], this.defaultCubeFormat, this.visualSettings.tooltipSettings.decimalPlaces, this.visualSettings.tooltipSettings.tooltipUnits)
                })
            }
            
            if ((this.extraTooltip != null) && this.visualSettings.tooltipSettings.showExtraValue && this.visualSettings.tooltipSettings.showDescription) {
                const totalValue = this.viewModel.dataPoints.filter(d => d.os == identifier).map(d => d.extraValue).reduce((a, b) => a + b, 0)
                tooltip.push({
                    displayName: this.extraTooltip.source.displayName + " Total",
                    value: this.formatValue(totalValue, this.defaultCubeFormat, this.visualSettings.tooltipSettings.decimalPlaces, this.visualSettings.tooltipSettings.tooltipUnits)       
                })
                tooltip.push({
                    displayName: this.visualSettings.tooltipSettings.titleDescription,
                    value: this.visualSettings.tooltipSettings.description
                })
            } else if ((this.extraTooltip != null) && this.visualSettings.tooltipSettings.showExtraValue && !this.visualSettings.tooltipSettings.showDescription) {
                const totalValue = this.viewModel.dataPoints.filter(d => d.os == identifier).map(d => d.extraValue).reduce((a, b) => a + b, 0)
                tooltip.push({
                    displayName: this.extraTooltip.source.displayName + " Total",
                    value: this.formatValue(totalValue, this.defaultCubeFormat, this.visualSettings.tooltipSettings.decimalPlaces, this.visualSettings.tooltipSettings.tooltipUnits)
                })
            } else if (this.visualSettings.tooltipSettings.showDescription) {
                tooltip.push({
                    displayName: this.visualSettings.tooltipSettings.titleDescription,
                    value: this.visualSettings.tooltipSettings.description
                })
            }
            
        }

        return tooltip
    }

    /**
     * Function Name: getTooltipIdentity
     * Description: Retrieves the selection identity from the provided value.
     *
     * @param {any} value - The value containing the selection identity.
     * @returns {powerbi.visuals.ISelectionId} - The selection identity.
     */
    private getTooltipIdentity(value: TooltipEventArgs<DataPoint>): powerbi.visuals.ISelectionId {

        return value["identity"]
    }



    /**
     * Function Name: dynamicFormat
     * Description: Dynamically formats a numeric value based on the specified format and default decimal places.
     *
     * @param {number} labelValue - The numeric value to be formatted.
     * @param {string} format - The format for the numeric value ("cube-billions", "cube-millions", "cube-thousands", or "default").
     * @param {number} defaultDecimalPlaces - The default number of decimal places to use in formatting.
     * @returns {string} - The dynamically formatted numeric value as a string.
     */
    private dynamicFormat(labelValue: number, format: string, setDecimalPlaces: number, roundValuesUp: boolean): string {
        let decimal = "1";
        let decimalSmallValues = "0.";
    
        for (let i = 1; i <= setDecimalPlaces; i++) {
            decimal += "0";
            decimalSmallValues += "0";
        }
    
        if (format === undefined || (format === "0" && labelValue === 0)) {
            return labelValue.toString();
        }
    
        if (format.includes("0.") && !format.includes("%") && !format.includes("$") && format !== "undefined") {
            const decimalPlaces = "0." + "0".repeat(setDecimalPlaces);
            return this.iValueFormatter.valueFormatter.create({ format: decimalPlaces || "0.0" }).format(labelValue);
        } else if (!format.includes("%") && format !== "undefined") {
            let value = "0";
            const sign = labelValue < 0 ? "-" : "";
            const absValue = Math.abs(labelValue);
            const decimalNum = parseFloat(decimal);
    
            if (absValue >= 1.0e+12) {
                value = sign + (format.includes("$") ? "$" : "") + (Math.round((absValue / 1.0e+12) * decimalNum) / decimalNum).toFixed(setDecimalPlaces) + "T";
            } else if (absValue >= 1.0e+9) {
                const over100 = Math.round(absValue / 1.0e+9) > 100;
                value = sign + (format.includes("$") ? "$" : "") + (Math.round((absValue / (over100 && roundValuesUp ? 1.0e+12 : 1.0e+9)) * decimalNum) / decimalNum).toFixed(setDecimalPlaces) + (over100 && roundValuesUp ? "T" : "B");
            } else if (absValue >= 1.0e+6) {
                const over100 = Math.round(absValue / 1.0e+6) > 100;
                value = sign + (format.includes("$") ? "$" : "") + (Math.round((absValue / (over100 && roundValuesUp ? 1.0e+9 : 1.0e+6)) * decimalNum) / decimalNum).toFixed(setDecimalPlaces) + (over100 && roundValuesUp ? "B" : "M");
            } else if (absValue >= 1.0e+3) {
                const over100 = Math.round(absValue / 1.0e+3) > 100;
                value = sign + (format.includes("$") ? "$" : "") + (Math.round((absValue / (over100 && roundValuesUp ? 1.0e+6 : 1.0e+3)) * decimalNum) / decimalNum).toFixed(setDecimalPlaces) + (over100 && roundValuesUp ? "M" : "K");
            } else if (absValue < (1 / decimalNum)) {
                value = sign + (format.includes("$") ? "$" : "") + (labelValue === 0 ? "0" : decimalSmallValues);
            } else {
                value = sign + (format.includes("$") ? "$" : "") + (Math.round(absValue * decimalNum) / decimalNum).toFixed(0);
            }
    
            return value;
        } else if (format.includes("%") && format !== "undefined") {
            return (labelValue < 0 ? "-" : "") + this.iValueFormatter.valueFormatter.create({ format: format || "0.0%;-0.0%;0.0%" }).format((Math.abs(labelValue) * 100).toFixed(setDecimalPlaces)) + "%";
        } else if (format === "undefined") {
            return labelValue.toString();
        }
    }

    public formatThousands(value, decimalCases) {
        return `$${(value / 1e3).toLocaleString(undefined, { minimumFractionDigits: decimalCases, maximumFractionDigits: decimalCases })}k`;
    }
    
    public formatMillions(value, decimalCases) {
        return `$${(value / 1e6).toLocaleString(undefined, { minimumFractionDigits: decimalCases, maximumFractionDigits: decimalCases })}M`;
    }
    
    public formatBillions(value, decimalCases) {
        return `$${(value / 1e9).toLocaleString(undefined, { minimumFractionDigits: decimalCases, maximumFractionDigits: decimalCases })}B`;
    }
    
    private formatValue(labelValue, format: string, decimalPlaces: number, displayUnits: string) {
        
        let formattedValue = displayUnits == "dynamic" ?
            this.dynamicFormat(labelValue, format, decimalPlaces, true) :
            displayUnits == "default" ?
                this.iValueFormatter.valueFormatter.create({ format: format || "#,0" }).format(labelValue) :
            displayUnits === "cube-thousands" ?
                this.formatThousands(labelValue, decimalPlaces) :
            displayUnits === "cube-millions" ?
                this.formatMillions(labelValue, decimalPlaces) :
            displayUnits === "cube-billions" ?
                this.formatBillions(labelValue, decimalPlaces) :
                d3.format(displayUnits)(labelValue);
    
        if (formattedValue.startsWith("-")) {
            formattedValue = `(${formattedValue.substring(1)})`;
        }
    
        return formattedValue;
    }



    /**
     * Function Name: getViewModel
     * Description: Constructs the ViewModel for the visualization based on the provided dataViews and options.
     *
     * @param {VisualUpdateOptions} options - The update options containing dataViews.
     * @returns {ViewModel} - The ViewModel containing data points, metadata, and calculated values for the visualization.
     */
    private getViewModel(options: VisualUpdateOptions): ViewModel {
        const dv = options.dataViews;

        const format = valueFormatter.valueFormatter;

        const viewModel: ViewModel = {
            dataPoints: [],
            maxValue: 0,
            average: 0,
            total: 0
        };

        if (!dv
            || !dv[0]
            || !dv[0].categorical
            || !dv[0].categorical.categories
            || !dv[0].categorical.categories[0].source
            || !dv[0].categorical.values
            || !dv[0].metadata)
            return viewModel;

        this.sortByValues = dv[0].metadata.columns.filter(d => d.sort)[0].isMeasure
        this.sortOrder = dv[0].metadata.columns.filter(d => d.sort)[0].sort

        const view = dv[0].categorical;

        const columns = dv[0].categorical.categories.length

        let categories;
        let oss;

        if (columns == 2) {
            categories = dv[0].categorical.categories.filter(d => d.source.roles["xaxis"])[0]
            oss = dv[0].categorical.categories.filter(d => d.source.roles["yaxis"])[0]
        }
        else if (columns == 1) {
            oss = view.categories[0];
            categories = view.categories[0];
        }

        const values = view.values[0];
        this.extraTooltip = view.values.filter(d => d.source.roles.extraTooltip).length > 0 ? view.values.filter(d => d.source.roles.extraTooltip)[0] : null

        this.existsSecondMeasure = view.values.filter(d => d.source.roles.secondmeasure).length > 0 && this.visualSettings.secondMeasureSettings.showValue == "second" ? true : false
        this.showSecondMeasureSettings = view.values.filter(d => d.source.roles.secondmeasure).length > 0 ? true : false
        this.existTargetMetric = view.values.filter(d => d.source.roles.target).length > 0 ? true : false
        this.targetValue = this.existTargetMetric ? <number>view.values.filter(d => d.source.roles.target)[0].values[0] : 0
        const objects = categories.objects;

        const metadata = dv[0].metadata;

        this.valueColumnName = metadata.columns.filter(d => d.roles["firstmeasure"])[0].displayName;

        const container = oss.values.map(d => d).filter(this.onlyUnique)
        let selected_color_scheme = "hexaColor"
        let davaViewOption = dataViewObjects.dataViewObjects.getFillColor
        let colors_range = []
        if (this.visualSettings.radialSettings.colorScheme == "color") {
            colors_range = ["blue", "green", "purple", "red", "grey", "orange"]
            selected_color_scheme = "color"
            davaViewOption = dataViewObjects.dataViewObjects.getValue
        } else if (this.visualSettings.radialSettings.colorScheme == "hexaColor") {
            colors_range = ["#C499CA", "#A0D1FF", "#E044A7", "#9B59B6", "#2980B9", "#C493EA", "#1ABC9C", "#16A085", "#F1C49F", "#F39C12", "#D35400", "#BDC3C7", "#7F8C8D", "#2C3E50", "#3F4CB0", "#E1EC4C"]
            selected_color_scheme = "hexaColor"
            davaViewOption = dataViewObjects.dataViewObjects.getFillColor
        } else if (this.visualSettings.radialSettings.colorScheme == "color_alternative") {
            colors_range = ["bugn", "bupu", "gnbu", "orrd", "pubugn", "pubu", "purd", "rdpu", "ylgnbu", "ylgn", "ylorbr", "ylorrd"]
            selected_color_scheme = "color_alternative"
            davaViewOption = dataViewObjects.dataViewObjects.getValue
        }


        const unique_categories = oss.values.filter(this.onlyUnique)
        this.cubeFormatIsPercentage = view.values.filter(d => d.source.isMeasure)[0].source.format && view.values.filter(d => d.source.isMeasure)[0].source.format.includes("0%") ? true : false;
        this.cubeFormat = format.create({ format: this.existsSecondMeasure && this.categorySelected ? view.values.filter(d => d.source.isMeasure)[1].source.format : view.values.filter(d => d.source.isMeasure)[0].source.format || "#,0" })
        this.defaultCubeFormat = this.existsSecondMeasure && this.categorySelected && view.values.filter(d => d.source.isMeasure)[1].source.format ? view.values.filter(d => d.source.isMeasure)[1].source.format : view.values.filter(d => d.source.isMeasure)[0].source.format

        if (this.defaultCubeFormat == undefined) {
            this.defaultCubeFormat = "$#,0;($#,0);$#,0"; // Corrected version
        }
        


        for (let i = 0, len = Math.max(categories.values.length, values.values.length); i < len; i++) {

            if (oss.values[i] == this.selectedCategoryName || !this.categorySelected) {
                let tooltip = [{displayName: "",
                    value: ""
                }]
                if (this.existsSecondMeasure && this.categorySelected) {
                    tooltip = [{
                        displayName: "Category",
                        value: <string>categories.values[i]
                    }, {
                        displayName: view.values.filter(d => d.source.isMeasure)[1].source.displayName,
                        value: this.formatValue(<number>view.values.filter(d => d.source.isMeasure)[1].values[i], view.values.filter(d => d.source.isMeasure)[1].source.format, this.visualSettings.secondMeasureSettings.decimalPlaces, this.visualSettings.secondMeasureSettings.tooltipUnits) 
                    }]
                } else {
                    tooltip = [{
                        displayName: "Category",
                        value: <string>categories.values[i]
                    }, {
                        displayName: this.valueColumnName,
                        value: this.formatValue(<number>values.values[i], this.defaultCubeFormat, this.visualSettings.tooltipSettings.decimalPlaces, this.visualSettings.tooltipSettings.tooltipUnits) 
                    }]
                }


                viewModel.dataPoints.push({
                    os: !this.categorySelected ? <string>oss.values[i] : <string>categories.values[i],
                    category: <string>categories.values[i],
                    value: <number>values.values[i],
                    valueSecondMeasure: this.existsSecondMeasure ? this.categorySelected ? <number>view.values.filter(d => d.source.isMeasure)[1].values[i] : <number>view.values.filter(d => d.source.isMeasure)[0].values[i] : 0,
                    target: this.existTargetMetric ? <number>view.values.filter(d => d.source.roles.target)[0].values[i] : 0,
                    extraValue: this.extraTooltip != null ? <number>this.extraTooltip.values[i] : 0,
                    accu: <number>values.values[i],
                    color: objects && <string>davaViewOption(objects[i],
                        { objectName: "radialSettings", propertyName: selected_color_scheme },
                        colors_range[unique_categories.indexOf(oss.values[i])]) || colors_range[unique_categories.indexOf(oss.values[i])],
                    identity: this.host.createSelectionIdBuilder()
                        .withCategory(view.categories[0], i)
                        .createSelectionId(),
                    tooltips: tooltip
                    
                })
            }
        }

        if (viewModel.dataPoints.length > 0) {
            viewModel.average = d3.sum(viewModel.dataPoints, d => d.value) / viewModel.dataPoints.length
            viewModel.total = d3.sum(viewModel.dataPoints.filter(d => d.category != null), d => d.value)
        }

        viewModel.maxValue = d3.max(viewModel.dataPoints, d => d.value);

        const accumulative = []

        for (let kk = 0; kk < container.length; kk++) {
            let mount = 0
            for (let pp = 0; pp < viewModel.dataPoints.length; pp++) {
                if (viewModel.dataPoints[pp].os == container[kk]) {
                    mount = mount + viewModel.dataPoints[pp].value
                    viewModel.dataPoints[pp].accu = mount
                }
            }
            accumulative.push(mount)
        }

        return viewModel;
    }
}