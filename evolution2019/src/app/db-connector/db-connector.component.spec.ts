import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DbConnectorComponent } from './db-connector.component';

describe('DbConnectorComponent', () => {
  let component: DbConnectorComponent;
  let fixture: ComponentFixture<DbConnectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DbConnectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DbConnectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
