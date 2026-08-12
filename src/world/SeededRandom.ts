export class SeededRandom{constructor(private state=0xdecafbad){}next():number{this.state=(Math.imul(this.state,1664525)+1013904223)>>>0;return this.state/0x100000000}}
